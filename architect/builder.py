"""Wave-parallel build orchestrator for Stage 3 of the architect.

Reads a build-package YAML produced by Decompose, wraps each component prompt
with type/language-specific shape examples, dispatches to local Ollama wave-by-wave,
post-processes output, writes files into a workspace, and assembles the project skeleton.
"""

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any
import yaml
import requests


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


class OllamaError(Exception):
    """Raised when Ollama returns an error or is unreachable."""


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: int = 180):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def generate(self, prompt: str) -> str:
        try:
            r = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
                timeout=self.timeout,
            )
            r.raise_for_status()
        except requests.RequestException as e:
            raise OllamaError(f"Ollama request failed: {e}") from e
        body = r.json()
        return body.get("response", "")


_DOCKERFILE_JS = """FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE {port}
CMD ["node", "src/app-server.js"]
"""

_DOCKERFILE_PY = """FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
ENV PYTHONUNBUFFERED=1
EXPOSE {port}
CMD ["python", "src/app.py"]
"""


def assemble_project(workspace: str, language: str, port: int, packages: list[str]) -> None:
    if language == "javascript":
        with open(os.path.join(workspace, "Dockerfile"), "w") as f:
            f.write(_DOCKERFILE_JS.format(port=port))
        deps = {pkg: "*" for pkg in packages}
        pkg_json = {
            "name": "architect-build",
            "version": "0.1.0",
            "type": "module",
            "scripts": {"start": "node src/app-server.js"},
            "dependencies": deps,
        }
        with open(os.path.join(workspace, "package.json"), "w") as f:
            json.dump(pkg_json, f, indent=2)
    elif language == "python":
        with open(os.path.join(workspace, "Dockerfile"), "w") as f:
            f.write(_DOCKERFILE_PY.format(port=port))
        with open(os.path.join(workspace, "requirements.txt"), "w") as f:
            f.write("\n".join(packages) + "\n")
    else:
        raise ValueError(f"Unsupported language for assembly: {language}")

    with open(os.path.join(workspace, ".env.example"), "w") as f:
        f.write("OPENWEATHER_API_KEY=\n")


_LANG_TO_EXT = {"javascript": "js", "python": "py", "typescript": "ts"}
_LANG_TO_PORT = {"javascript": 3000, "python": 5000, "typescript": 3000}
_DEFAULT_PACKAGES_BY_LANG = {
    "javascript": ["express", "node-fetch", "dotenv"],
    "python": ["flask", "requests"],
    "typescript": ["express", "node-fetch", "dotenv"],
}


def _build_component(
    component: dict,
    package: BuildPackage,
    workspace: str,
    ollama: OllamaClient,
    runtime: str,
    emit,
) -> dict:
    component_id = component["id"]
    ext = _LANG_TO_EXT[package.language]
    target_relpath = f"src/{component_id}.{ext}"
    target_path = os.path.join(workspace, target_relpath)
    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    emit("build:component:start", {"component_id": component_id})
    started = time.time()
    try:
        wrapped = wrap_prompt(
            component,
            language=package.language,
            runtime=runtime,
            allowed_packages=_DEFAULT_PACKAGES_BY_LANG[package.language],
            target_relpath=target_relpath,
        )
        raw = ollama.generate(wrapped)
        cleaned = post_process_output(raw)
        with open(target_path, "w") as f:
            f.write(cleaned)
        duration_ms = int((time.time() - started) * 1000)
        emit(
            "build:component:done",
            {"component_id": component_id, "file_path": target_relpath, "duration_ms": duration_ms},
        )
        return {"component_id": component_id, "ok": True}
    except (OllamaError, PostProcessError) as e:
        emit("build:component:error", {"component_id": component_id, "error": str(e)})
        return {"component_id": component_id, "ok": False, "error": str(e)}


def run_build(
    package_path: str,
    workspace: str,
    ollama: OllamaClient,
    emit,
    runtime: str = "Node 20",
) -> dict:
    package = parse_build_package(package_path)
    started = time.time()
    emit(
        "build:start",
        {
            "total_components": sum(len(w) for w in package.waves),
            "total_waves": len(package.waves),
        },
    )

    max_par = max(1, package.metadata.get("max_parallelism", 1))
    component_durations: list[int] = []

    for wave_idx, components in enumerate(package.waves):
        wave_started = time.time()
        emit(
            "build:wave:start",
            {"wave_index": wave_idx, "components": [c["id"] for c in components]},
        )
        with ThreadPoolExecutor(max_workers=max_par) as ex:
            futures = [
                ex.submit(_build_component, c, package, workspace, ollama, runtime, emit)
                for c in components
            ]
            for f in as_completed(futures):
                f.result()
        wave_dur_ms = int((time.time() - wave_started) * 1000)
        component_durations.append(wave_dur_ms)
        emit("build:wave:done", {"wave_index": wave_idx, "duration_ms": wave_dur_ms})

    # Project assembly (best-effort — if any wave produced files, assemble)
    src_dir = os.path.join(workspace, "src")
    if os.path.isdir(src_dir) and any(os.scandir(src_dir)):
        assemble_project(
            workspace,
            language=package.language,
            port=_LANG_TO_PORT[package.language],
            packages=_DEFAULT_PACKAGES_BY_LANG[package.language],
        )

    total_ms = int((time.time() - started) * 1000)
    emit("build:complete", {"duration_ms": total_ms})
    return {"workspace": workspace, "duration_ms": total_ms}
