"""Wave-parallel build orchestrator for Stage 3 of the architect.

Reads a build-package YAML produced by Decompose, wraps each component prompt
with type/language-specific shape examples, dispatches to local Ollama wave-by-wave,
post-processes output, writes files into a workspace, and assembles the project skeleton.
"""

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
