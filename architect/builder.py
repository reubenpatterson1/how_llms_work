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


_OBJECTIVE_RE = re.compile(r"Objective:\s*(.+)", re.IGNORECASE)


def _derive_name_from_purpose(purpose_lines: list[str]) -> str | None:
    """Best-effort name derivation when metadata.name is absent.

    Looks for an 'Objective:' line in the spec's purpose and extracts the first
    few significant words. e.g. 'Objective: Ship a team task tracker for ...'
    -> 'team-task-tracker'.
    """
    skip_words = {"a", "an", "the", "build", "ship", "create", "make", "for", "of", "to", "and", "or"}
    for line in purpose_lines:
        m = _OBJECTIVE_RE.search(str(line))
        if not m:
            continue
        words = re.findall(r"[A-Za-z][A-Za-z0-9]*", m.group(1).lower())
        kept = [w for w in words if w not in skip_words][:4]
        if kept:
            return "-".join(kept)
    return None


def parse_build_package(path: str) -> BuildPackage:
    with open(path, "r") as f:
        data = yaml.safe_load(f)

    metadata = data.get("metadata", {})
    spec = data.get("spec", {})
    name = metadata.get("name") or _derive_name_from_purpose(spec.get("purpose", [])) or "app"

    dag = data.get("dag") or {}
    waves_dict: dict[int, list[dict]] = {}
    for component_id, comp in dag.items():
        comp_with_id = {**comp, "id": component_id}
        waves_dict.setdefault(comp["wave"], []).append(comp_with_id)

    waves = [waves_dict[w] for w in sorted(waves_dict.keys())]
    language = _detect_language(spec.get("tech_stack", []))

    return BuildPackage(
        metadata=metadata,
        spec=spec,
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


_APP_SERVER_SHIM_JS = '''// Auto-generated entry point. Built by architect.builder.assemble_project
// because the build-package's components didn't include an `app-server`.
// Mounts any default-exported Express routers from sibling files.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || __PORT__;

// Always-on healthcheck — guarantees the K8s liveness probe passes
// even if no generated handler provided one.
app.get('/healthz', (req, res) => res.status(200).json({status: 'ok'}));

// Auto-mount any default-exported routers from sibling files.
// Routers are functions; models/configs/services that aren't routers get skipped.
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'app-server.js');
for (const f of files) {
  try {
    const mod = await import('./' + f);
    if (mod.default && typeof mod.default === 'function') {
      app.use('/', mod.default);
      console.log('mounted /', f);
    }
  } catch (e) {
    console.warn('skip', f, e.message);
  }
}

// Fallback root response if no handler claimed it
app.get('/', (req, res) => res.type('html').send(
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hello World</title></head>' +
  '<body style="font-family:sans-serif;text-align:center;margin-top:4rem;background:#0f172a;color:#e2e8f0;">' +
  '<h1>Hello, World!</h1><div id="clock"></div>' +
  '<script>function tick(){document.getElementById("clock").textContent=new Date().toLocaleTimeString()};tick();setInterval(tick,1000)</script>' +
  '</body></html>'
));

app.listen(PORT, () => console.log(`app-server listening on :${PORT}`));
'''


_APP_SERVER_SHIM_PY = '''"""Auto-generated entry point. Built by architect.builder.assemble_project
because the build-package's components didn't include an `app-server`.

The Python Dockerfile CMD is fixed at `python src/app.py`, but decompose-output
build-packages emit Flask *Blueprint fragments* (`bp = Blueprint(...)` plus
`@bp.get(...)` handlers) with no `Flask(__name__)` and no `app.run(...)`, so
without this file the container dies at once with
`python: can't open file '/app/src/app.py'`.

This shim creates the Flask app, auto-registers every module-level Blueprint
found in sibling `src/*.py` files, and always serves `/healthz` so the K8s
healthcheck passes even when no generated component provided one.
"""
import importlib.util
import os
import re
import sys

from flask import Blueprint, Flask, jsonify

_HERE = os.path.dirname(os.path.abspath(__file__))
# Sibling modules may import each other by module name. `python src/app.py` already
# puts src on sys.path; be explicit so in-process loading behaves identically.
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# Keep __pycache__ out of src/: architect.deployer scans every file under src/ as
# text, and a .pyc there makes derive_healthcheck_path() fail on decode.
sys.dont_write_bytecode = True

app = Flask(__name__)
# Read PORT without dict.get() on purpose: architect.deployer's route scraper treats
# any `.get('literal')` as an HTTP route, so os.environ.get('PORT') would become a
# bogus healthcheck candidate in the rendered deploy YAML.
PORT = int(os.environ["PORT"]) if "PORT" in os.environ else __PORT__


# Always-on healthcheck - guarantees the K8s probe passes even if no generated
# handler provided one. Declared with @app.get (not @app.route) so that
# architect.deployer.derive_healthcheck_path() can discover it.
@app.get("/healthz")
def _healthz():
    return jsonify({"status": "ok"}), 200


# A module-level `<name>.run(` in a component (app.run/asyncio.run/uvicorn.run) would
# block this loop forever and the app would never start listening. Skip those files.
_MODULE_LEVEL_RUN = re.compile(r"^\\w+\\.run\\(", re.MULTILINE)


def _load_module(path, mod_name):
    spec = importlib.util.spec_from_file_location(mod_name, path)
    if spec is None or spec.loader is None:
        raise ImportError("no loader for " + path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    spec.loader.exec_module(module)
    return module


# Auto-register any module-level Flask Blueprint from sibling files. Blueprints are
# Blueprint instances; models/configs/services that are not blueprints get skipped.
_seen_blueprints = set()
for _fname in sorted(os.listdir(_HERE)):
    if not _fname.endswith(".py") or _fname == "app.py" or _fname.startswith("_"):
        continue
    _path = os.path.join(_HERE, _fname)
    _mod_name = "_arch_component_" + re.sub(r"[^0-9A-Za-z_]", "_", _fname[:-3])
    try:
        with open(_path, "r") as _f:
            _source = _f.read()
        if _MODULE_LEVEL_RUN.search(_source):
            print("skip " + _fname + ": module-level .run() would block startup", file=sys.stderr)
            continue
        _module = _load_module(_path, _mod_name)
    except Exception as _exc:
        print("skip " + _fname + ": " + repr(_exc), file=sys.stderr)
        continue
    for _attr, _obj in vars(_module).items():
        if not isinstance(_obj, Blueprint) or id(_obj) in _seen_blueprints:
            continue
        _seen_blueprints.add(id(_obj))
        try:
            try:
                app.register_blueprint(_obj)
            except ValueError:
                app.register_blueprint(_obj, name=_mod_name + "_" + _attr)
            print("registered blueprint " + _obj.name + " from " + _fname, file=sys.stderr)
        except Exception as _exc:
            print("skip blueprint " + _attr + " in " + _fname + ": " + repr(_exc), file=sys.stderr)

# Fallback root response if no generated blueprint claimed "/".
if not any(_rule.rule == "/" for _rule in app.url_map.iter_rules()):

    @app.get("/")
    def _root():
        return (
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hello World</title></head>'
            '<body style="font-family:sans-serif;text-align:center;margin-top:4rem;background:#0f172a;color:#e2e8f0;">'
            '<h1>Hello, World!</h1><div id="clock"></div>'
            '<script>function tick(){document.getElementById("clock").textContent=new Date().toLocaleTimeString()};tick();setInterval(tick,1000)</script>'
            '</body></html>'
        )


if __name__ == "__main__":
    # host=0.0.0.0 is required: Flask defaults to 127.0.0.1, which is unreachable
    # from outside the container network namespace.
    app.run(host="0.0.0.0", port=PORT)
'''


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
        # Write app-server.js shim ONLY if the build agent didn't already generate one.
        # Decompose-output build-packages typically don't include an `app-server` component,
        # so the Dockerfile's `node src/app-server.js` CMD has nothing to run without this.
        os.makedirs(os.path.join(workspace, "src"), exist_ok=True)
        shim_path = os.path.join(workspace, "src", "app-server.js")
        if not os.path.exists(shim_path):
            with open(shim_path, "w") as f:
                f.write(_APP_SERVER_SHIM_JS.replace("__PORT__", str(port)))
    elif language == "python":
        with open(os.path.join(workspace, "Dockerfile"), "w") as f:
            f.write(_DOCKERFILE_PY.format(port=port))
        with open(os.path.join(workspace, "requirements.txt"), "w") as f:
            f.write("\n".join(packages) + "\n")
        # Write app.py shim ONLY if the build agent didn't already generate one.
        # Decompose-output build-packages emit Flask Blueprint fragments with no
        # Flask app and no app.run(), so the Dockerfile's `python src/app.py` CMD
        # has nothing to run without this.
        os.makedirs(os.path.join(workspace, "src"), exist_ok=True)
        shim_path = os.path.join(workspace, "src", "app.py")
        if not os.path.exists(shim_path):
            with open(shim_path, "w") as f:
                f.write(_APP_SERVER_SHIM_PY.replace("__PORT__", str(port)))
    else:
        raise ValueError(f"Unsupported language for assembly: {language}")

    with open(os.path.join(workspace, ".env.example"), "w") as f:
        f.write("OPENWEATHER_API_KEY=\n")


_LANG_TO_EXT = {"javascript": "js", "python": "py", "typescript": "ts"}
_LANG_TO_PORT = {"javascript": 3000, "python": 3000, "typescript": 3000}
_DEFAULT_PACKAGES_BY_LANG = {
    "javascript": ["express", "node-fetch", "dotenv"],
    "python": ["flask", "requests"],
    "typescript": ["express", "node-fetch", "dotenv"],
}


def _safe_filename(component_id: str) -> str:
    """Slugify a component_id for use as a filename. Decompose may emit names like
    'city entity with name-model' that don't work as ESM import paths.
    """
    s = re.sub(r"[^a-zA-Z0-9_-]+", "-", component_id).strip("-").lower()
    return s or "component"


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
    target_relpath = f"src/{_safe_filename(component_id)}.{ext}"
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
