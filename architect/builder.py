"""Wave-parallel build orchestrator for Stage 3 of the architect.

Reads a build-package YAML produced by Decompose, wraps each component prompt
with type/language-specific shape examples, dispatches to local Ollama wave-by-wave,
post-processes output, writes files into a workspace, and assembles the project skeleton.
"""

import os
import re
from dataclasses import dataclass, field
from typing import Any
import yaml


@dataclass
class BuildPackage:
    metadata: dict
    spec: dict
    waves: list[list[dict]]
    language: str
    spec_slug: str  # K8s/DNS-safe slug derived from metadata.name; used as the resource-name root


_LANG_KEYWORDS = {
    "javascript": ["javascript", "js", "node"],
    "python": ["python", "py"],
    "typescript": ["typescript", "ts"],
}

_SLUG_RE = re.compile(r"[^a-z0-9-]+")


def _detect_language(tech_stack_lines: list[str]) -> str:
    joined = " ".join(tech_stack_lines).lower()
    for lang, keywords in _LANG_KEYWORDS.items():
        if any(k in joined for k in keywords):
            return lang
    raise ValueError(f"Could not detect language from tech_stack: {tech_stack_lines}")


def _slugify(name: str) -> str:
    """Produce a K8s/DNS-safe slug: lowercase, hyphenated, no leading/trailing hyphens."""
    s = _SLUG_RE.sub("-", name.lower()).strip("-")
    if not s:
        raise ValueError(f"name slugifies to empty string: {name!r}")
    return s[:40]  # K8s name limit is 63; leave headroom for run-suffix


def parse_build_package(path: str) -> BuildPackage:
    with open(path, "r") as f:
        data = yaml.safe_load(f)

    metadata = data.get("metadata", {})
    name = metadata.get("name")
    if not name:
        raise ValueError(
            "build-package YAML is missing required field metadata.name "
            "(spec slug used to name K8s resources, ECR tag, ingress host)"
        )

    dag = data.get("dag", {})
    waves_dict: dict[int, list[dict]] = {}
    for component_id, comp in dag.items():
        comp_with_id = {**comp, "id": component_id}
        waves_dict.setdefault(comp["wave"], []).append(comp_with_id)

    waves = [waves_dict[w] for w in sorted(waves_dict.keys())]
    language = _detect_language(data.get("spec", {}).get("tech_stack", []))

    return BuildPackage(
        metadata=metadata,
        spec=data.get("spec", {}),
        waves=waves,
        language=language,
        spec_slug=_slugify(name),
    )


_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "builder_templates")


def _load_shape_template(component_type: str, language: str) -> str:
    candidate = os.path.join(_TEMPLATE_DIR, f"{component_type}_{language}.txt")
    if not os.path.exists(candidate):
        # Fall back to service template for the language
        candidate = os.path.join(_TEMPLATE_DIR, f"service_{language}.txt")
    with open(candidate, "r") as f:
        return f.read().strip()


def wrap_prompt(
    component: dict,
    language: str,
    runtime: str,
    allowed_packages: list[str],
    target_relpath: str,
) -> str:
    shape = _load_shape_template(component["type"], language)
    constraints_block = "\n".join(f"- {c}" for c in component.get("constraints", []))
    if not constraints_block:
        constraints_block = "- (none)"

    return (
        "You are generating one source file. Output the file CONTENTS ONLY — "
        "no markdown fences, no prose, no explanation, no comments outside the code. "
        "The first character of your response must be the first character of the file.\n\n"
        f"Target file: {target_relpath}\n"
        f"Runtime: {runtime}\n"
        f"Allowed packages (already installed): {', '.join(allowed_packages) if allowed_packages else '(none)'}\n\n"
        "File shape (mimic this exactly):\n"
        f"{shape}\n\n"
        f"Component purpose: {component.get('id', 'unnamed')} ({component.get('type', 'unknown')})\n"
        f"Architecture constraints:\n{constraints_block}\n\n"
        f"Original component prompt: {component.get('prompt', '').strip()}\n\n"
        f"Produce {target_relpath} now."
    )


class PostProcessError(Exception):
    """Raised when LLM output cannot be cleaned into usable code."""


_FENCE_RE = re.compile(r"```(?:[a-zA-Z0-9_+-]*)?\s*\n(.*?)\n```", re.DOTALL)


def post_process_output(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        raise PostProcessError("LLM returned empty output")

    # If fenced anywhere, take the first fenced block
    fence_match = _FENCE_RE.search(text)
    if fence_match:
        return fence_match.group(1).strip() + "\n"

    # No fence — heuristic: if it starts with code-like content (import/from/class/function/const/let/var/def),
    # accept as-is. Otherwise it's prose and we error.
    code_starters = (
        "import ", "from ", "export ", "const ", "let ", "var ", "function ",
        "class ", "def ", "async ", "#!", "//", "/*", "@", "public ", "private ",
    )
    first_nonblank = next((line for line in text.splitlines() if line.strip()), "")
    if first_nonblank.lstrip().startswith(code_starters):
        return text + "\n"

    raise PostProcessError(
        f"LLM output looks like prose, not code. First line: {first_nonblank[:80]!r}"
    )
