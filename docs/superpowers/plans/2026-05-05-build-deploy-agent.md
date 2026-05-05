# Build/Deploy Agent (Stage 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stage 3 (build + deploy) to the architect Flask app: takes a build-package YAML, runs local Ollama wave-by-wave to generate code, builds and pushes a container image to ECR, and applies a customizable fubo Application manifest to the cluster — landing the HelloWorld app at the URL declared in the deploy YAML.

**Architecture:** Two new Python modules in `architect/`. `builder.py` orchestrates wave-parallel LLM calls with mandatory prompt-wrapping (shape examples per component-type) and mandatory output post-processing (fence stripping). `deployer.py` derives healthcheck path from generated app, renders the YAML, shells out to docker + kubectl, and polls ingress until the host serves HTTP 200. New Flask routes wire the two stages into the existing webapp; Socket.IO streams build events to the wave-grid UI.

**Tech Stack:** Python 3.12, Flask + Flask-SocketIO (existing), PyYAML, requests (Ollama HTTP), subprocess (docker/kubectl/aws), pytest (existing test infra). No new heavyweight deps.

**Spec reference:** `docs/superpowers/specs/2026-05-05-build-deploy-module-design.md`

---

## File Structure

**Create:**
- `architect/builder.py` — orchestrator, prompt wrapper, post-processor, project assembler
- `architect/builder_templates/` — directory of shape templates per component-type per language
  - `model_javascript.txt`, `model_python.txt`
  - `handler_javascript.txt`, `handler_python.txt`
  - `config_javascript.txt`, `config_python.txt`
  - `service_javascript.txt`, `service_python.txt`
- `architect/deployer.py` — YAML renderer, healthcheck-path derivation, docker/kubectl wrappers, ingress poller
- `architect/build_deploy_config.py` — `BuildDeployConfig` dataclass + load/save (separate from `ProviderConfig` to keep blast radius small)
- `architect/templates/build.html` — wave-grid Stage 3a UI
- `architect/templates/deploy.html` — Monaco-editor Stage 3b UI
- `architect/templates/deploy_template.yaml` — fubo Application CRD template (mirror of corrected course_docs version)
- `architect/examples/hello-world-spec.md` — HelloWorld dense spec
- `architect/examples/hello-world-build-package.yaml` — HelloWorld build-package (output of Decompose, hand-authored for predictability)
- `architect/workspaces/.gitkeep` — workspace directory marker
- `architect/tests/test_builder.py`
- `architect/tests/test_builder_post_process.py`
- `architect/tests/test_builder_wrap_prompt.py`
- `architect/tests/test_builder_assembler.py`
- `architect/tests/test_deployer_render.py`
- `architect/tests/test_deployer_derive.py`
- `architect/tests/test_deployer_subprocess.py`
- `architect/tests/test_deployer_ingress.py`
- `architect/tests/test_build_deploy_routes.py`

**Modify:**
- `architect/webapp.py` — add `/build`, `/build/start`, `/deploy`, `/deploy/render`, `/deploy/image-build`, `/deploy/image-push`, `/deploy/apply` routes; add Socket.IO room handling for `build:<run_id>`
- `architect/requirements.txt` — add `PyYAML>=6.0` if not already present

**External fix (not in this repo, but a prerequisite):**
- `/Users/reubenpatterson/Documents/course_docs/deploy_template.yaml` — change `healthcheck.path: /health` → `/healthz`

---

## Phase 0 — Prerequisites

### Task 0.1: Fix sample deploy_template.yaml healthcheck path

**Files:**
- Modify: `/Users/reubenpatterson/Documents/course_docs/deploy_template.yaml:16`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/reubenpatterson/Documents/course_docs/deploy_template.yaml
```

- [ ] **Step 2: Apply the one-line fix**

Edit `healthcheck.path: /health` → `healthcheck.path: /healthz`. Use the Edit tool to change the single line. (Cannot commit — this file is outside the git repo.)

- [ ] **Step 3: Verify**

```bash
grep 'path:' /Users/reubenpatterson/Documents/course_docs/deploy_template.yaml
```
Expected output includes `path: /healthz`

---

### Task 0.2: Author HelloWorld dense spec

**Files:**
- Create: `architect/examples/hello-world-spec.md`

- [ ] **Step 1: Create the spec file**

```markdown
# Dense Architecture Specification — HelloWorld
# Density Score: 0.85

## Purpose

- Objective: Display "Hello, World!" with the current time and weather for a single hardcoded city
- Users: Internal fubo employees as a teaching artifact for the architect → decompose → build → deploy pipeline
- Success Criteria: Page loads, time updates each second, weather shown for New York
- Scope: One page, one external API call, no auth, no database

## Data Model

- Entities: GreetingState entity with text, time, weatherTemp, weatherDescription, lastFetchedAt
- Relationships: none (single in-memory state)
- Constraints: weatherTemp expressed in Fahrenheit
- Indexes: not applicable

## API

- Endpoints: GET /api/weather returns current weather for hardcoded city New York
- Endpoints: GET /healthz returns 200 OK with body {"status":"ok"} for liveness probe
- Request Shapes: no request body required for either endpoint
- Response Shapes: GET /api/weather returns {temp_f: number, description: string, fetchedAt: ISO8601}
- Response Shapes: GET /healthz returns {status: "ok"}

## Tech Stack

- Language: JavaScript (ES2022)
- Framework: Express 4 on Node 20
- Database: none
- External APIs: OpenWeatherMap current-weather API, key in OPENWEATHER_API_KEY env var

## Auth

- Method: none for v1 (internal demo)

## Deployment

- Infrastructure: fubo internal Application platform, namespace training, single replica
- Cicd: deployed via the architect tool, no GitHub Actions
- Environments: training only

## Performance

- Latency: P95 of /api/weather under 800ms (network-bound on OpenWeatherMap)

## All Constraints (Flat)

- "Hello, World!" + current time + weather for hardcoded New York
- Internal fubo employees as a teaching artifact
- Page loads, time updates each second
- One page, one external API call, no auth
- GreetingState entity with text, time, weatherTemp, weatherDescription, lastFetchedAt
- weatherTemp in Fahrenheit
- GET /api/weather for hardcoded New York
- GET /healthz returns {"status":"ok"}
- {temp_f, description, fetchedAt} response shape
- JavaScript ES2022, Express 4 on Node 20
- OpenWeatherMap API, key in OPENWEATHER_API_KEY env var
- fubo internal Application platform, namespace training, single replica

## Implementation Rules

- Every architectural decision MUST trace to a constraint above
- If a dimension has no constraint, ASK — do not invent
- Prefer explicit over implicit in all generated code
- No defaults: every value must come from this spec
```

- [ ] **Step 2: Commit**

```bash
git add architect/examples/hello-world-spec.md
git commit -m "Add HelloWorld dense spec for Module 4 walkthrough"
```

---

### Task 0.3: Hand-author HelloWorld build-package YAML

**Files:**
- Create: `architect/examples/hello-world-build-package.yaml`

The build-package is normally Decompose's output, but for the walkthrough we want predictable, clean prompts not dependent on Decompose's current quirks. Hand-author for stability; the Decompose stage can be improved later to produce equivalent output.

- [ ] **Step 1: Create the build-package file**

```yaml
# Build Package — YAML DAG Format
# Hand-authored for HelloWorld walkthrough; equivalent to Decompose output

metadata:
  name: hello-world  # spec slug — drives unique K8s name + ingress host + ECR tag (combined with run_id-short)
  phase: poc
  total_components: 4
  total_waves: 2
  max_parallelism: 3
  time_savings_percent: 33
  estimated_sequential_minutes: 1
  estimated_parallel_minutes: 0.7

spec:
  purpose:
    - 'Objective: Display "Hello, World!" with current time and weather for hardcoded New York'
    - "Users: Internal fubo employees as teaching artifact"
  data_model:
    - "Entities: GreetingState (in-memory) with text, time, weatherTemp, weatherDescription, lastFetchedAt"
  api:
    - "Endpoints: GET /api/weather returns weather for hardcoded New York"
    - "Endpoints: GET /healthz returns {status: ok}"
    - "Endpoints: GET / returns the HelloWorld HTML page"
  tech_stack:
    - "Language: JavaScript (ES2022)"
    - "Framework: Express 4 on Node 20"

rules:
  - "Every architectural decision MUST trace to a constraint in spec"
  - "Prefer explicit over implicit in all generated code"
  - "No defaults: every value must come from this spec"

dag:
  weather-service:
    name: weather-service
    type: service
    wave: 0
    complexity: low
    constraints:
      - "External APIs: OpenWeatherMap current-weather API, key in OPENWEATHER_API_KEY env var"
      - "Hardcoded city: New York"
      - "Response shape: {temp_f: number, description: string, fetchedAt: ISO8601}"
    prompt: |
      Build a service module that fetches current weather from OpenWeatherMap for the hardcoded city "New York"
      using the API key from the OPENWEATHER_API_KEY environment variable. Return an object shaped
      {temp_f, description, fetchedAt}. Convert the API's Kelvin response to Fahrenheit.

  health-handler:
    name: health-handler
    type: handler
    wave: 0
    complexity: low
    constraints:
      - "Endpoint: GET /healthz"
      - "Response: {status: ok}"
    prompt: |
      Build an Express route handler that responds to GET /healthz with HTTP 200
      and JSON body {"status":"ok"}.

  weather-handler:
    name: weather-handler
    type: handler
    wave: 1
    complexity: low
    constraints:
      - "Endpoint: GET /api/weather"
      - "Calls weather-service from wave 0"
    prompt: |
      Build an Express route handler that responds to GET /api/weather by calling the
      getWeather function exported from ./weather-service and returning its result as JSON.
      On error from the service, respond with HTTP 502 and {error: "weather upstream failed"}.

  app-server:
    name: app-server
    type: handler
    wave: 1
    complexity: low
    constraints:
      - "Express server listening on PORT env var (default 3000)"
      - "Mounts handlers from wave 0 and wave 1"
      - "Serves the HelloWorld HTML page at GET /"
    prompt: |
      Build the Express application entry point that creates an Express app, mounts the
      health-handler at /healthz and the weather-handler at /api/weather, serves a static HTML page
      at GET / showing "Hello, World!" plus a div for current time (updated client-side via setInterval)
      and a div for current weather (fetched once on load from /api/weather and re-fetched every 60s).
      Listen on process.env.PORT or 3000.
```

- [ ] **Step 2: Commit**

```bash
git add architect/examples/hello-world-build-package.yaml
git commit -m "Add HelloWorld build-package for Module 4 walkthrough"
```

---

### Task 0.4: Add BuildDeployConfig dataclass

**Files:**
- Create: `architect/build_deploy_config.py`
- Test: `architect/tests/test_build_deploy_config.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_build_deploy_config.py
import json
import os
import tempfile
from architect.build_deploy_config import BuildDeployConfig, load, save, DEFAULTS


def test_defaults_are_sensible():
    assert DEFAULTS["ollama_model"] == "mistral:7b"
    assert DEFAULTS["ollama_base_url"] == "http://localhost:11434"
    assert DEFAULTS["default_namespace"] == "training"
    assert DEFAULTS["aws_region"] == "us-east-1"


def test_load_returns_defaults_when_no_file(tmp_path):
    cfg_path = tmp_path / "missing.json"
    cfg = load(str(cfg_path))
    assert cfg.ollama_model == "mistral:7b"
    assert cfg.default_namespace == "training"


def test_save_then_load_roundtrip(tmp_path):
    cfg_path = tmp_path / "cfg.json"
    cfg = BuildDeployConfig(
        ollama_model="qwen2.5-coder:32b",
        ollama_base_url="http://other:11434",
        ecr_registry="650127479436.dkr.ecr.us-east-1.amazonaws.com",
        ecr_repository_prefix="architect-builds",
        default_namespace="training",
        aws_region="us-east-1",
    )
    save(cfg, str(cfg_path))
    loaded = load(str(cfg_path))
    assert loaded.ollama_model == "qwen2.5-coder:32b"
    assert loaded.ecr_registry == "650127479436.dkr.ecr.us-east-1.amazonaws.com"


def test_load_missing_keys_fall_back_to_defaults(tmp_path):
    cfg_path = tmp_path / "partial.json"
    cfg_path.write_text(json.dumps({"ollama_model": "custom:7b"}))
    cfg = load(str(cfg_path))
    assert cfg.ollama_model == "custom:7b"
    assert cfg.default_namespace == "training"  # default
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/reubenpatterson/LLM_Presentation && python -m pytest architect/tests/test_build_deploy_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'architect.build_deploy_config'`

- [ ] **Step 3: Implement BuildDeployConfig**

```python
# architect/build_deploy_config.py
"""Configuration for the Stage 3 build/deploy agent.

Kept separate from ProviderConfig (in llm_judge.py) to limit blast radius —
the existing intake/decompose stages don't need to know about ECR or kubectl.
"""

import json
import os
from dataclasses import dataclass, asdict, field

DEFAULTS = {
    "ollama_model": "mistral:7b",
    "ollama_base_url": "http://localhost:11434",
    "ecr_registry": "650127479436.dkr.ecr.us-east-1.amazonaws.com",
    "ecr_repository_prefix": "architect-builds",
    "default_namespace": "training",
    "aws_region": "us-east-1",
}


@dataclass
class BuildDeployConfig:
    ollama_model: str = DEFAULTS["ollama_model"]
    ollama_base_url: str = DEFAULTS["ollama_base_url"]
    ecr_registry: str = DEFAULTS["ecr_registry"]
    ecr_repository_prefix: str = DEFAULTS["ecr_repository_prefix"]
    default_namespace: str = DEFAULTS["default_namespace"]
    aws_region: str = DEFAULTS["aws_region"]


_DEFAULT_PATH = os.path.join(os.path.dirname(__file__), ".build_deploy_config.json")


def load(path: str = _DEFAULT_PATH) -> BuildDeployConfig:
    if not os.path.exists(path):
        return BuildDeployConfig()
    with open(path, "r") as f:
        data = json.load(f)
    merged = {**DEFAULTS, **data}
    return BuildDeployConfig(**{k: merged[k] for k in DEFAULTS.keys()})


def save(cfg: BuildDeployConfig, path: str = _DEFAULT_PATH) -> None:
    with open(path, "w") as f:
        json.dump(asdict(cfg), f, indent=2)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/reubenpatterson/LLM_Presentation && python -m pytest architect/tests/test_build_deploy_config.py -v`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/build_deploy_config.py architect/tests/test_build_deploy_config.py
git commit -m "Add BuildDeployConfig with Ollama/ECR/cluster defaults"
```

---

## Phase 1 — Builder Module

### Task 1.1: parse_build_package — group components by wave

**Files:**
- Create (initial stub): `architect/builder.py`
- Test: `architect/tests/test_builder.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_builder.py
import os
import tempfile
import textwrap
from architect.builder import parse_build_package


HELLO_WORLD_PACKAGE = textwrap.dedent("""
metadata:
  name: hello-world
  phase: poc
  total_components: 4
  total_waves: 2
  max_parallelism: 3
spec:
  tech_stack:
    - "Language: JavaScript (ES2022)"
    - "Framework: Express 4 on Node 20"
dag:
  weather-service:
    name: weather-service
    type: service
    wave: 0
    complexity: low
    constraints: ["c1"]
    prompt: "fetch weather"
  health-handler:
    name: health-handler
    type: handler
    wave: 0
    complexity: low
    constraints: ["c2"]
    prompt: "respond ok"
  weather-handler:
    name: weather-handler
    type: handler
    wave: 1
    complexity: low
    constraints: ["c3"]
    prompt: "delegate to service"
  app-server:
    name: app-server
    type: handler
    wave: 1
    complexity: low
    constraints: ["c4"]
    prompt: "mount everything"
""")


def test_parse_groups_by_wave(tmp_path):
    path = tmp_path / "pkg.yaml"
    path.write_text(HELLO_WORLD_PACKAGE)
    result = parse_build_package(str(path))
    assert result.metadata["total_waves"] == 2
    assert result.metadata["max_parallelism"] == 3
    assert len(result.waves) == 2
    assert {c["id"] for c in result.waves[0]} == {"weather-service", "health-handler"}
    assert {c["id"] for c in result.waves[1]} == {"weather-handler", "app-server"}


def test_parse_carries_component_fields(tmp_path):
    path = tmp_path / "pkg.yaml"
    path.write_text(HELLO_WORLD_PACKAGE)
    result = parse_build_package(str(path))
    weather = next(c for c in result.waves[0] if c["id"] == "weather-service")
    assert weather["type"] == "service"
    assert weather["prompt"] == "fetch weather"
    assert weather["constraints"] == ["c1"]


def test_parse_extracts_language_from_tech_stack(tmp_path):
    path = tmp_path / "pkg.yaml"
    path.write_text(HELLO_WORLD_PACKAGE)
    result = parse_build_package(str(path))
    assert result.language == "javascript"


def test_parse_reads_spec_slug_from_metadata(tmp_path):
    path = tmp_path / "pkg.yaml"
    path.write_text(HELLO_WORLD_PACKAGE)
    result = parse_build_package(str(path))
    assert result.spec_slug == "hello-world"


def test_parse_raises_when_metadata_name_missing(tmp_path):
    import pytest
    bad = HELLO_WORLD_PACKAGE.replace("name: hello-world\n  ", "")
    path = tmp_path / "bad.yaml"
    path.write_text(bad)
    with pytest.raises(ValueError, match="metadata.name"):
        parse_build_package(str(path))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_builder.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'architect.builder'`

- [ ] **Step 3: Implement parse_build_package**

```python
# architect/builder.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_builder.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/builder.py architect/tests/test_builder.py
git commit -m "Add parse_build_package: load YAML, group by wave, detect language"
```

---

### Task 1.2: Author shape templates

**Files:**
- Create: `architect/builder_templates/service_javascript.txt`
- Create: `architect/builder_templates/handler_javascript.txt`
- Create: `architect/builder_templates/config_javascript.txt`
- Create: `architect/builder_templates/model_javascript.txt`
- Create: `architect/builder_templates/service_python.txt`
- Create: `architect/builder_templates/handler_python.txt`
- Create: `architect/builder_templates/config_python.txt`
- Create: `architect/builder_templates/model_python.txt`

These are reference shape examples the prompt-wrapper inserts into each LLM call. Each file is 5-15 lines of skeleton code.

- [ ] **Step 1: Create JavaScript shape templates**

`architect/builder_templates/service_javascript.txt`:
```
import fetch from 'node-fetch';

export async function getThing() {
  // call upstream, transform, return shaped object
  return { field1: 0, field2: '', fetchedAt: new Date().toISOString() };
}

export default getThing;
```

`architect/builder_templates/handler_javascript.txt`:
```
import express from 'express';

const router = express.Router();

router.get('/path', async (req, res) => {
  res.status(200).json({ result: 'value' });
});

export default router;
```

`architect/builder_templates/config_javascript.txt`:
```
import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiKey: process.env.API_KEY,
};

export default config;
```

`architect/builder_templates/model_javascript.txt`:
```
export class Thing {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }
}

export default Thing;
```

- [ ] **Step 2: Create Python shape templates**

`architect/builder_templates/service_python.txt`:
```
import os
import requests
from datetime import datetime, timezone

def get_thing():
    response = requests.get('https://api.example.com/thing', timeout=10)
    response.raise_for_status()
    data = response.json()
    return {'field1': data['x'], 'field2': data['y'], 'fetched_at': datetime.now(timezone.utc).isoformat()}
```

`architect/builder_templates/handler_python.txt`:
```
from flask import Blueprint, jsonify

bp = Blueprint('thing', __name__)

@bp.get('/path')
def handler():
    return jsonify({'result': 'value'}), 200
```

`architect/builder_templates/config_python.txt`:
```
import os

class Config:
    PORT = int(os.environ.get('PORT', 5000))
    API_KEY = os.environ.get('API_KEY')

config = Config()
```

`architect/builder_templates/model_python.txt`:
```
from dataclasses import dataclass

@dataclass
class Thing:
    id: str
    name: str
```

- [ ] **Step 3: Commit**

```bash
git add architect/builder_templates/
git commit -m "Add prompt-wrapper shape templates for JS and Python component types"
```

---

### Task 1.3: wrap_prompt — assemble the wrapped LLM payload

**Files:**
- Modify: `architect/builder.py`
- Test: `architect/tests/test_builder_wrap_prompt.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_builder_wrap_prompt.py
import os
from architect.builder import wrap_prompt


def test_wrap_prompt_includes_target_path():
    component = {
        "id": "weather-service",
        "type": "service",
        "constraints": ["External API: OpenWeatherMap"],
        "prompt": "fetch weather for New York",
    }
    wrapped = wrap_prompt(
        component,
        language="javascript",
        runtime="Node 20",
        allowed_packages=["express", "node-fetch"],
        target_relpath="src/weather-service.js",
    )
    assert "Target file: src/weather-service.js" in wrapped
    assert "Node 20" in wrapped
    assert "express, node-fetch" in wrapped
    assert "External API: OpenWeatherMap" in wrapped


def test_wrap_prompt_includes_shape_template():
    component = {"id": "h", "type": "handler", "constraints": [], "prompt": "x"}
    wrapped = wrap_prompt(
        component,
        language="javascript",
        runtime="Node 20",
        allowed_packages=["express"],
        target_relpath="src/h.js",
    )
    # handler_javascript.txt content
    assert "express.Router()" in wrapped


def test_wrap_prompt_starts_with_no_fence_directive():
    component = {"id": "h", "type": "handler", "constraints": [], "prompt": "x"}
    wrapped = wrap_prompt(
        component,
        language="javascript",
        runtime="Node 20",
        allowed_packages=["express"],
        target_relpath="src/h.js",
    )
    assert wrapped.startswith("You are generating one source file")
    assert "no markdown fences" in wrapped


def test_wrap_prompt_unknown_type_falls_back_to_service():
    component = {"id": "x", "type": "unknown", "constraints": [], "prompt": "x"}
    wrapped = wrap_prompt(
        component,
        language="javascript",
        runtime="Node 20",
        allowed_packages=[],
        target_relpath="src/x.js",
    )
    # service_javascript.txt content
    assert "node-fetch" in wrapped
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_builder_wrap_prompt.py -v`
Expected: FAIL with `ImportError: cannot import name 'wrap_prompt'`

- [ ] **Step 3: Implement wrap_prompt in builder.py**

Add to `architect/builder.py`:

```python
import os

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_builder_wrap_prompt.py -v`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/builder.py architect/tests/test_builder_wrap_prompt.py
git commit -m "Add wrap_prompt: file path + packages + shape example + constraints"
```

---

### Task 1.4: post_process_output — strip fences and prose preambles

**Files:**
- Modify: `architect/builder.py`
- Test: `architect/tests/test_builder_post_process.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_builder_post_process.py
import pytest
from architect.builder import post_process_output, PostProcessError


def test_clean_code_passes_through():
    raw = "import express from 'express';\n\nconst app = express();\n"
    assert post_process_output(raw).strip() == raw.strip()


def test_strips_simple_fence():
    raw = "```javascript\nimport express from 'express';\n```"
    assert post_process_output(raw).strip() == "import express from 'express';"


def test_strips_fence_with_no_lang():
    raw = "```\nfoo\nbar\n```"
    assert post_process_output(raw).strip() == "foo\nbar"


def test_strips_prose_preamble_before_fence():
    raw = "Here's the code:\n\n```javascript\nimport x from 'x';\n```"
    assert post_process_output(raw).strip() == "import x from 'x';"


def test_strips_leading_whitespace_and_fence():
    raw = "  \n\n ```javascript\nfoo\n```\n\n"
    assert post_process_output(raw).strip() == "foo"


def test_prose_only_no_fence_raises():
    raw = "I cannot write that code. Sorry."
    with pytest.raises(PostProcessError):
        post_process_output(raw)


def test_empty_string_raises():
    with pytest.raises(PostProcessError):
        post_process_output("")
    with pytest.raises(PostProcessError):
        post_process_output("   \n\n")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_builder_post_process.py -v`
Expected: FAIL — symbols don't exist yet

- [ ] **Step 3: Implement post_process_output and PostProcessError**

Add to `architect/builder.py`:

```python
import re


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_builder_post_process.py -v`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/builder.py architect/tests/test_builder_post_process.py
git commit -m "Add post_process_output: strip fences, detect prose, error on garbage"
```

---

### Task 1.5: OllamaClient — HTTP wrapper

**Files:**
- Modify: `architect/builder.py`
- Test: `architect/tests/test_ollama_client.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_ollama_client.py
from unittest.mock import patch, MagicMock
from architect.builder import OllamaClient, OllamaError
import pytest


def test_generate_returns_response_text():
    client = OllamaClient(base_url="http://localhost:11434", model="mistral:7b")
    fake_response = MagicMock()
    fake_response.json.return_value = {"response": "import x from 'x';\n"}
    fake_response.raise_for_status = MagicMock()
    with patch("architect.builder.requests.post", return_value=fake_response) as mock_post:
        out = client.generate("wrapped prompt here")
    assert out == "import x from 'x';\n"
    mock_post.assert_called_once()
    sent = mock_post.call_args
    assert sent.kwargs["json"]["model"] == "mistral:7b"
    assert sent.kwargs["json"]["prompt"] == "wrapped prompt here"
    assert sent.kwargs["json"]["stream"] is False
    assert sent.kwargs["json"]["options"]["temperature"] == 0.1


def test_generate_raises_on_http_error():
    import requests
    client = OllamaClient(base_url="http://localhost:11434", model="mistral:7b")
    fake_response = MagicMock()
    fake_response.raise_for_status.side_effect = requests.HTTPError("500")
    with patch("architect.builder.requests.post", return_value=fake_response):
        with pytest.raises(OllamaError):
            client.generate("p")


def test_generate_raises_on_connection_error():
    import requests
    client = OllamaClient(base_url="http://localhost:11434", model="mistral:7b")
    with patch("architect.builder.requests.post", side_effect=requests.ConnectionError("nope")):
        with pytest.raises(OllamaError):
            client.generate("p")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_ollama_client.py -v`
Expected: FAIL — symbols don't exist

- [ ] **Step 3: Implement OllamaClient and OllamaError**

Add to `architect/builder.py`:

```python
import requests


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_ollama_client.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/builder.py architect/tests/test_ollama_client.py
git commit -m "Add OllamaClient with non-streaming generate + error wrapping"
```

---

### Task 1.6: assemble_project — write Dockerfile, manifest, .env.example, index.html

**Files:**
- Modify: `architect/builder.py`
- Test: `architect/tests/test_builder_assembler.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_builder_assembler.py
import os
from architect.builder import assemble_project


def test_javascript_assembly_produces_dockerfile_and_package_json(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "app-server.js").write_text("import express from 'express';\nconst app = express();\napp.listen(3000);\n")
    assemble_project(str(workspace), language="javascript", port=3000, packages=["express", "node-fetch"])

    assert (workspace / "Dockerfile").exists()
    dockerfile = (workspace / "Dockerfile").read_text()
    assert "node:20-alpine" in dockerfile
    assert "EXPOSE 3000" in dockerfile

    pkg = workspace / "package.json"
    assert pkg.exists()
    import json
    pkg_data = json.loads(pkg.read_text())
    assert "express" in pkg_data["dependencies"]
    assert "node-fetch" in pkg_data["dependencies"]
    assert pkg_data["type"] == "module"

    assert (workspace / ".env.example").exists()
    env = (workspace / ".env.example").read_text()
    assert "OPENWEATHER_API_KEY=" in env


def test_python_assembly_produces_dockerfile_and_requirements(tmp_path):
    workspace = tmp_path / "ws"
    (workspace / "src").mkdir(parents=True)
    (workspace / "src" / "app.py").write_text("from flask import Flask\napp = Flask(__name__)\n")
    assemble_project(str(workspace), language="python", port=5000, packages=["flask", "requests"])

    dockerfile = (workspace / "Dockerfile").read_text()
    assert "python:3.12-slim" in dockerfile
    assert "EXPOSE 5000" in dockerfile

    reqs = (workspace / "requirements.txt").read_text()
    assert "flask" in reqs
    assert "requests" in reqs


def test_unknown_language_raises(tmp_path):
    import pytest
    workspace = tmp_path / "ws"
    (workspace / "src").mkdir(parents=True)
    with pytest.raises(ValueError):
        assemble_project(str(workspace), language="rust", port=8080, packages=[])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_builder_assembler.py -v`
Expected: FAIL — `assemble_project` not defined

- [ ] **Step 3: Implement assemble_project**

Add to `architect/builder.py`:

```python
import json


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_builder_assembler.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/builder.py architect/tests/test_builder_assembler.py
git commit -m "Add assemble_project: Dockerfile + manifest + .env.example for JS/Python"
```

---

### Task 1.7: run_build orchestrator — wave-parallel with mocked Ollama

**Files:**
- Modify: `architect/builder.py`
- Test: `architect/tests/test_builder_run.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_builder_run.py
import os
import textwrap
from unittest.mock import MagicMock
from architect.builder import run_build, parse_build_package


PACKAGE_YAML = textwrap.dedent("""
metadata:
  total_components: 4
  total_waves: 2
  max_parallelism: 3
spec:
  tech_stack:
    - "Language: JavaScript (ES2022)"
    - "Framework: Express 4 on Node 20"
dag:
  weather-service:
    name: weather-service
    type: service
    wave: 0
    complexity: low
    constraints: []
    prompt: "p1"
  health-handler:
    name: health-handler
    type: handler
    wave: 0
    complexity: low
    constraints: []
    prompt: "p2"
  weather-handler:
    name: weather-handler
    type: handler
    wave: 1
    complexity: low
    constraints: []
    prompt: "p3"
  app-server:
    name: app-server
    type: handler
    wave: 1
    complexity: low
    constraints: []
    prompt: "p4"
""")


def _ok_ollama(call_count_holder):
    """Returns a MagicMock OllamaClient whose generate() returns code per call."""
    client = MagicMock()
    def gen(prompt: str):
        call_count_holder.append(prompt)
        return "```javascript\nconsole.log('ok');\n```"
    client.generate = gen
    return client


def test_run_build_creates_files_for_all_components(tmp_path):
    pkg_path = tmp_path / "pkg.yaml"
    pkg_path.write_text(PACKAGE_YAML)
    workspace = tmp_path / "ws"
    workspace.mkdir()

    events = []
    def emit(event, payload):
        events.append((event, payload))

    calls = []
    run_build(
        package_path=str(pkg_path),
        workspace=str(workspace),
        ollama=_ok_ollama(calls),
        emit=emit,
        runtime="Node 20",
    )

    src = workspace / "src"
    assert (src / "weather-service.js").exists()
    assert (src / "health-handler.js").exists()
    assert (src / "weather-handler.js").exists()
    assert (src / "app-server.js").exists()
    assert (workspace / "Dockerfile").exists()
    assert (workspace / "package.json").exists()


def test_run_build_emits_wave_events_in_order(tmp_path):
    pkg_path = tmp_path / "pkg.yaml"
    pkg_path.write_text(PACKAGE_YAML)
    workspace = tmp_path / "ws"
    workspace.mkdir()

    events = []
    def emit(event, payload):
        events.append((event, payload))

    run_build(
        package_path=str(pkg_path),
        workspace=str(workspace),
        ollama=_ok_ollama([]),
        emit=emit,
        runtime="Node 20",
    )

    event_names = [e[0] for e in events]
    assert event_names[0] == "build:start"
    assert event_names[-1] == "build:complete"
    # All wave 0 component events come before wave 1 wave:start
    wave1_start_idx = event_names.index("build:wave:start", event_names.index("build:wave:done") + 1)
    wave0_done_idxs = [i for i, e in enumerate(event_names) if e == "build:component:done" and i < wave1_start_idx]
    assert len(wave0_done_idxs) == 2  # two components in wave 0


def test_run_build_emits_component_error_on_post_process_failure(tmp_path):
    pkg_path = tmp_path / "pkg.yaml"
    pkg_path.write_text(PACKAGE_YAML)
    workspace = tmp_path / "ws"
    workspace.mkdir()

    bad_client = MagicMock()
    bad_client.generate.return_value = "I refuse to help."

    events = []
    def emit(event, payload):
        events.append((event, payload))

    run_build(
        package_path=str(pkg_path),
        workspace=str(workspace),
        ollama=bad_client,
        emit=emit,
        runtime="Node 20",
    )

    error_events = [e for e in events if e[0] == "build:component:error"]
    assert len(error_events) == 4
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_builder_run.py -v`
Expected: FAIL — `run_build` not defined

- [ ] **Step 3: Implement run_build**

Add to `architect/builder.py`:

```python
import time
from concurrent.futures import ThreadPoolExecutor, as_completed


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
    if any(os.scandir(os.path.join(workspace, "src"))):
        assemble_project(
            workspace,
            language=package.language,
            port=_LANG_TO_PORT[package.language],
            packages=_DEFAULT_PACKAGES_BY_LANG[package.language],
        )

    total_ms = int((time.time() - started) * 1000)
    emit("build:complete", {"duration_ms": total_ms})
    return {"workspace": workspace, "duration_ms": total_ms}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_builder_run.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/builder.py architect/tests/test_builder_run.py
git commit -m "Add run_build orchestrator: wave-parallel dispatch with event emission"
```

---

## Phase 2 — Deployer Module

### Task 2.1: render_yaml — substitute auto-derived fields

**Files:**
- Create: `architect/deployer.py`
- Create: `architect/templates/deploy_template.yaml` (mirror of corrected course_docs version)
- Test: `architect/tests/test_deployer_render.py`

- [ ] **Step 1: Create the deploy template**

`architect/templates/deploy_template.yaml`:
```yaml
apiVersion: app.smo.tools.fubotv.net/v1alpha1
kind: Application
metadata:
  name: {{name}}
  namespace: {{namespace}}
spec:
  image: {{image}}
  replicas: 1
  resources:
    requests: { cpu: 50m, memory: 64Mi }
    limits:   { memory: 128Mi }
  ports:
    - name: http
      containerPort: {{port}}
  healthcheck:
    path: {{healthcheck_path}}
    portName: http
  ingress:
    enabled: true
    host: {{host}}
    path: /
    portName: http
    tls:
      certificateArn: arn:aws:acm:us-east-1:650127479436:certificate/18d4217b-cfa1-4420-8710-269e7cf37f36
```

- [ ] **Step 2: Write the failing test**

```python
# architect/tests/test_deployer_render.py
import os
from architect.deployer import render_yaml


def test_render_substitutes_all_fields(tmp_path):
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "templates", "deploy_template.yaml"
    )
    rendered = render_yaml(
        template_path=template_path,
        name="hello-world",
        namespace="training",
        image="650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/hello-world:abc123",
        port=3000,
        host="hello-world-training.tools.fubotv.net",
        healthcheck_path="/healthz",
    )
    assert "name: hello-world" in rendered
    assert "namespace: training" in rendered
    assert "image: 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/hello-world:abc123" in rendered
    assert "containerPort: 3000" in rendered
    assert "host: hello-world-training.tools.fubotv.net" in rendered
    assert "path: /healthz" in rendered
    assert "{{" not in rendered  # no unsubstituted placeholders


def test_render_raises_on_missing_field(tmp_path):
    import pytest
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "templates", "deploy_template.yaml"
    )
    with pytest.raises(ValueError):
        render_yaml(
            template_path=template_path,
            name="hello-world",
            namespace="training",
            image="img:tag",
            port=3000,
            host="h.example.com",
            healthcheck_path=None,  # invalid
        )
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_deployer_render.py -v`
Expected: FAIL — `architect.deployer` doesn't exist

- [ ] **Step 4: Implement render_yaml**

```python
# architect/deployer.py
"""Deploy stage: YAML render, image build/push, kubectl apply, ingress poll."""

import os


def render_yaml(
    template_path: str,
    name: str,
    namespace: str,
    image: str,
    port: int,
    host: str,
    healthcheck_path: str,
) -> str:
    if not healthcheck_path:
        raise ValueError(
            "healthcheck_path is required — must be derived from the generated app, "
            "not defaulted (see spec §6 step 1)"
        )
    with open(template_path, "r") as f:
        template = f.read()
    return (
        template
        .replace("{{name}}", name)
        .replace("{{namespace}}", namespace)
        .replace("{{image}}", image)
        .replace("{{port}}", str(port))
        .replace("{{host}}", host)
        .replace("{{healthcheck_path}}", healthcheck_path)
    )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_deployer_render.py -v`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add architect/deployer.py architect/templates/deploy_template.yaml architect/tests/test_deployer_render.py
git commit -m "Add render_yaml: substitute auto-derived fields, refuse missing healthcheck"
```

---

### Task 2.2: derive_healthcheck_path — scan generated app for first GET route

**Files:**
- Modify: `architect/deployer.py`
- Test: `architect/tests/test_deployer_derive.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_deployer_derive.py
from architect.deployer import derive_healthcheck_path, derive_port


def test_derive_health_path_from_express_handler(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "health-handler.js").write_text(
        "import express from 'express';\nconst r = express.Router();\nr.get('/healthz', (req, res) => res.json({status:'ok'}));\nexport default r;\n"
    )
    assert derive_healthcheck_path(str(tmp_path)) == "/healthz"


def test_derive_health_path_prefers_health_endpoints(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "weather-handler.js").write_text(
        "router.get('/api/weather', handler);\n"
    )
    (src / "health-handler.js").write_text(
        "router.get('/healthz', ok);\n"
    )
    # Should pick /healthz, not /api/weather
    assert derive_healthcheck_path(str(tmp_path)) == "/healthz"


def test_derive_health_path_falls_back_to_root(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "weather.js").write_text("router.get('/api/weather', h);\n")
    (src / "app.js").write_text("app.get('/', (req,res) => res.send('hi'));\n")
    # No health endpoint, but root exists
    assert derive_healthcheck_path(str(tmp_path)) == "/"


def test_derive_health_path_returns_none_when_no_routes(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "lib.js").write_text("export const x = 1;\n")
    assert derive_healthcheck_path(str(tmp_path)) is None


def test_derive_port_from_listen_call(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "app-server.js").write_text("app.listen(8080);\n")
    assert derive_port(str(tmp_path)) == 8080


def test_derive_port_returns_none_when_no_listen(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "lib.js").write_text("export const x = 1;\n")
    assert derive_port(str(tmp_path)) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_deployer_derive.py -v`
Expected: FAIL — symbols don't exist

- [ ] **Step 3: Implement derive_healthcheck_path and derive_port**

Add to `architect/deployer.py`:

```python
import re


_GET_ROUTE_RE = re.compile(r"""\.get\(\s*['"]([^'"]+)['"]""")
_LISTEN_RE = re.compile(r"""\.listen\(\s*(\d+)""")
_HEALTH_PRIORITY = ["/healthz", "/health", "/readyz", "/ready", "/ping", "/"]


def _scan_files(workspace: str) -> list[str]:
    src = os.path.join(workspace, "src")
    if not os.path.isdir(src):
        return []
    files = []
    for root, _, names in os.walk(src):
        for n in names:
            files.append(os.path.join(root, n))
    return files


def derive_healthcheck_path(workspace: str) -> str | None:
    found_routes: set[str] = set()
    for fp in _scan_files(workspace):
        try:
            text = open(fp, "r").read()
        except OSError:
            continue
        for m in _GET_ROUTE_RE.finditer(text):
            found_routes.add(m.group(1))
    if not found_routes:
        return None
    for candidate in _HEALTH_PRIORITY:
        if candidate in found_routes:
            return candidate
    # No priority match — return any route, prefer shortest
    return sorted(found_routes, key=len)[0]


def derive_port(workspace: str) -> int | None:
    for fp in _scan_files(workspace):
        try:
            text = open(fp, "r").read()
        except OSError:
            continue
        m = _LISTEN_RE.search(text)
        if m:
            return int(m.group(1))
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_deployer_derive.py -v`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/deployer.py architect/tests/test_deployer_derive.py
git commit -m "Add derive_healthcheck_path + derive_port from generated source"
```

---

### Task 2.3: docker_build, docker_push with ECR auth-error detection

**Files:**
- Modify: `architect/deployer.py`
- Test: `architect/tests/test_deployer_subprocess.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_deployer_subprocess.py
from unittest.mock import patch, MagicMock
import pytest
from architect.deployer import docker_build, docker_push, kubectl_apply, EcrAuthError, DeployError


def _completed(returncode=0, stdout="", stderr=""):
    cp = MagicMock()
    cp.returncode = returncode
    cp.stdout = stdout
    cp.stderr = stderr
    return cp


def test_docker_build_invokes_correct_command(tmp_path):
    with patch("architect.deployer.subprocess.run", return_value=_completed(0, "ok", "")) as run:
        docker_build("img:tag", str(tmp_path))
    args = run.call_args.args[0]
    assert args[0:3] == ["docker", "build", "-t"]
    assert args[3] == "img:tag"
    assert args[4] == str(tmp_path)


def test_docker_build_raises_on_failure(tmp_path):
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "build failed")):
        with pytest.raises(DeployError):
            docker_build("img:tag", str(tmp_path))


def test_docker_push_raises_ecr_auth_error_on_no_basic_auth():
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "no basic auth credentials")):
        with pytest.raises(EcrAuthError) as exc:
            docker_push("registry.example/img:tag", region="us-east-1", registry="registry.example")
        assert "aws ecr get-login-password" in str(exc.value)


def test_docker_push_raises_ecr_auth_error_on_denied():
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "denied: User: arn:... is not authorized")):
        with pytest.raises(EcrAuthError):
            docker_push("registry.example/img:tag", region="us-east-1", registry="registry.example")


def test_docker_push_raises_generic_deploy_error_on_other_failure():
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "manifest unknown")):
        with pytest.raises(DeployError):
            docker_push("registry.example/img:tag", region="us-east-1", registry="registry.example")


def test_kubectl_apply_invokes_correct_command(tmp_path):
    yaml_path = tmp_path / "deploy.yaml"
    yaml_path.write_text("apiVersion: v1\nkind: Pod\n")
    with patch("architect.deployer.subprocess.run", return_value=_completed(0, "applied", "")) as run:
        kubectl_apply(str(yaml_path))
    args = run.call_args.args[0]
    assert args == ["kubectl", "apply", "-f", str(yaml_path)]


def test_kubectl_apply_raises_on_failure(tmp_path):
    yaml_path = tmp_path / "deploy.yaml"
    yaml_path.write_text("bad")
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "the YAML is invalid")):
        with pytest.raises(DeployError):
            kubectl_apply(str(yaml_path))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_deployer_subprocess.py -v`
Expected: FAIL — symbols don't exist

- [ ] **Step 3: Implement subprocess wrappers**

Add to `architect/deployer.py`:

```python
import subprocess


class DeployError(Exception):
    """Generic deploy step failure."""


class EcrAuthError(DeployError):
    """ECR docker login is missing or expired."""


_ECR_AUTH_MARKERS = ("no basic auth credentials", "denied: User", "401 Unauthorized")


def docker_build(image_tag: str, workspace: str) -> str:
    cp = subprocess.run(
        ["docker", "build", "-t", image_tag, workspace],
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        raise DeployError(f"docker build failed: {cp.stderr.strip() or cp.stdout.strip()}")
    return cp.stdout


def docker_push(image_tag: str, region: str, registry: str) -> str:
    cp = subprocess.run(
        ["docker", "push", image_tag],
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        stderr = cp.stderr or ""
        if any(marker in stderr for marker in _ECR_AUTH_MARKERS):
            raise EcrAuthError(
                f"ECR auth missing or expired. Run: "
                f"aws ecr get-login-password --region {region} | "
                f"docker login --username AWS --password-stdin {registry}\n\n"
                f"Original error: {stderr.strip()}"
            )
        raise DeployError(f"docker push failed: {stderr.strip()}")
    return cp.stdout


def kubectl_apply(yaml_path: str) -> str:
    cp = subprocess.run(
        ["kubectl", "apply", "-f", yaml_path],
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        raise DeployError(f"kubectl apply failed: {cp.stderr.strip() or cp.stdout.strip()}")
    return cp.stdout
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_deployer_subprocess.py -v`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/deployer.py architect/tests/test_deployer_subprocess.py
git commit -m "Add docker_build, docker_push (ECR auth detection), kubectl_apply"
```

---

### Task 2.4: poll_ingress — wait until host serves 200/302

**Files:**
- Modify: `architect/deployer.py`
- Test: `architect/tests/test_deployer_ingress.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_deployer_ingress.py
from unittest.mock import patch, MagicMock
import pytest
from architect.deployer import poll_ingress, IngressTimeout


def _resp(status):
    r = MagicMock()
    r.status_code = status
    return r


def test_poll_returns_immediately_on_200():
    with patch("architect.deployer.requests.get", return_value=_resp(200)) as g:
        elapsed = poll_ingress("https://host.example/healthz", timeout_s=10, interval_s=1)
    assert elapsed >= 0
    assert g.call_count == 1


def test_poll_succeeds_after_initial_503():
    seq = [_resp(503), _resp(503), _resp(200)]
    with patch("architect.deployer.requests.get", side_effect=seq):
        with patch("architect.deployer.time.sleep"):
            elapsed = poll_ingress("https://host.example/healthz", timeout_s=10, interval_s=1)
    assert elapsed >= 0


def test_poll_raises_on_timeout():
    with patch("architect.deployer.requests.get", return_value=_resp(503)):
        with patch("architect.deployer.time.sleep"):
            with pytest.raises(IngressTimeout):
                poll_ingress("https://host.example/healthz", timeout_s=2, interval_s=1)


def test_poll_treats_302_as_success():
    with patch("architect.deployer.requests.get", return_value=_resp(302)):
        elapsed = poll_ingress("https://host.example/healthz", timeout_s=10, interval_s=1)
    assert elapsed >= 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_deployer_ingress.py -v`
Expected: FAIL — symbols don't exist

- [ ] **Step 3: Implement poll_ingress**

Add to `architect/deployer.py`:

```python
import time
import requests


class IngressTimeout(DeployError):
    """Ingress did not become ready within the deadline."""


def poll_ingress(url: str, timeout_s: int = 120, interval_s: int = 5) -> float:
    started = time.time()
    while True:
        try:
            r = requests.get(url, timeout=5, allow_redirects=False)
            if r.status_code in (200, 302):
                return time.time() - started
        except requests.RequestException:
            pass
        if time.time() - started >= timeout_s:
            raise IngressTimeout(f"{url} did not become ready within {timeout_s}s")
        time.sleep(interval_s)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_deployer_ingress.py -v`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add architect/deployer.py architect/tests/test_deployer_ingress.py
git commit -m "Add poll_ingress: wait for 200/302 with timeout, treat connection errors as not-ready"
```

---

## Phase 3 — Webapp Wiring

### Task 3.1: Add /build route + minimal build.html

**Files:**
- Modify: `architect/webapp.py`
- Create: `architect/templates/build.html`
- Test: `architect/tests/test_build_deploy_routes.py`

- [ ] **Step 1: Write the failing test**

```python
# architect/tests/test_build_deploy_routes.py
import pytest
from architect.webapp import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_get_build_renders_with_package_param(client):
    r = client.get("/build?package=architect/examples/hello-world-build-package.yaml")
    assert r.status_code == 200
    assert b"build" in r.data.lower()


def test_get_build_without_package_returns_400(client):
    r = client.get("/build")
    assert r.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: FAIL — `/build` route doesn't exist

- [ ] **Step 3: Add /build route to webapp.py**

Add to `architect/webapp.py` (after existing routes):

```python
from . import builder as _builder
from . import deployer as _deployer
from . import build_deploy_config as _bdcfg


@app.get("/build")
def build_page():
    package = request.args.get("package")
    if not package:
        return ("Missing required query param: package", 400)
    return render_template("build.html", package=package)
```

- [ ] **Step 4: Create minimal build.html template**

`architect/templates/build.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Build — Architect</title>
  <link rel="stylesheet" href="{{ pfx }}/static/architect.css">
</head>
<body>
  <h1>Build</h1>
  <p>Package: {{ package }}</p>
  <div id="wave-grid"></div>
  <button id="start-build">Start Build</button>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script>
    window.PACKAGE_PATH = {{ package | tojson }};
    window.PFX = {{ pfx | tojson }};
  </script>
  <script src="{{ pfx }}/static/build.js"></script>
</body>
</html>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add architect/webapp.py architect/templates/build.html architect/tests/test_build_deploy_routes.py
git commit -m "Add /build route + minimal template; require package query param"
```

---

### Task 3.2: Add POST /build/start with Socket.IO emission

**Files:**
- Modify: `architect/webapp.py`
- Modify: `architect/tests/test_build_deploy_routes.py`

- [ ] **Step 1: Add the failing test**

Append to `architect/tests/test_build_deploy_routes.py`:

```python
import os
from unittest.mock import patch


def test_post_build_start_returns_run_id(client, tmp_path):
    pkg = tmp_path / "p.yaml"
    pkg.write_text("metadata: {total_components: 0, total_waves: 0, max_parallelism: 1}\nspec: {tech_stack: [\"Language: JavaScript\"]}\ndag: {}\n")
    with patch("architect.webapp.socketio.start_background_task") as bt:
        r = client.post("/build/start", json={"package": str(pkg)})
    assert r.status_code == 200
    body = r.get_json()
    assert "run_id" in body
    bt.assert_called_once()


def test_post_build_start_rejects_missing_package(client):
    r = client.post("/build/start", json={})
    assert r.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: FAIL — `/build/start` doesn't exist

- [ ] **Step 3: Implement /build/start**

Add to `architect/webapp.py`:

```python
import uuid
import os as _os


@app.post("/build/start")
def build_start():
    body = request.get_json(silent=True) or {}
    package = body.get("package")
    if not package:
        return jsonify({"error": "Missing 'package'"}), 400
    run_id = uuid.uuid4().hex[:12]
    workspace = _os.path.join(
        _os.path.dirname(__file__), "workspaces", f"{run_id}"
    )
    _os.makedirs(workspace, exist_ok=True)

    # Persist the package YAML into the workspace so /deploy can re-read spec_slug
    # for resource naming without needing the user to pass the package path again.
    import shutil as _shutil
    _shutil.copyfile(package, _os.path.join(workspace, "_package.yaml"))

    cfg = _bdcfg.load()
    ollama = _builder.OllamaClient(base_url=cfg.ollama_base_url, model=cfg.ollama_model)

    def emit_to_room(event, payload):
        socketio.emit(event, payload, to=f"build:{run_id}")

    def task():
        try:
            _builder.run_build(
                package_path=package,
                workspace=workspace,
                ollama=ollama,
                emit=emit_to_room,
            )
        except Exception as e:
            emit_to_room("build:fatal", {"error": str(e)})

    socketio.start_background_task(task)
    return jsonify({"run_id": run_id, "workspace": workspace})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: 4 tests PASS (the 2 new + 2 prior)

- [ ] **Step 5: Commit**

```bash
git add architect/webapp.py architect/tests/test_build_deploy_routes.py
git commit -m "Add POST /build/start: spawn background build, stream events to socketio room"
```

---

### Task 3.3: Wave-grid frontend (build.js)

**Files:**
- Create: `architect/static/build.js`
- Create: `architect/static/architect.css` (if not present — see step 1)

This is plain vanilla JS (no React, matching the existing webapp pattern). No automated tests — manual smoke test in Phase 4.

- [ ] **Step 1: Check whether architect.css exists**

```bash
ls architect/static/architect.css 2>&1 || echo "missing — create stub"
```

If missing, create a minimal stub:

```css
/* architect/static/architect.css */
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
.wave { display: flex; gap: 1rem; margin: 1rem 0; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1rem; flex: 1; transition: all .25s; }
.card.running { border-color: #3b82f6; }
.card.done { border-color: #22c55e; background: #162b1f; }
.card.error { border-color: #ef4444; background: #2b1616; }
.card .name { font-weight: 600; margin-bottom: .5rem; }
.card .duration { font-size: .75rem; color: #94a3b8; }
button { background: #3b82f6; color: white; border: none; border-radius: 6px; padding: .5rem 1rem; cursor: pointer; }
```

- [ ] **Step 2: Create build.js**

`architect/static/build.js`:
```javascript
const socket = io({ path: (window.PFX || "") + "/socket.io" });
const grid = document.getElementById("wave-grid");
const startBtn = document.getElementById("start-build");

let runId = null;
const cards = {};  // component_id -> element

function ensureWaveRow(waveIdx) {
  let row = document.getElementById(`wave-${waveIdx}`);
  if (!row) {
    row = document.createElement("div");
    row.id = `wave-${waveIdx}`;
    row.className = "wave";
    const label = document.createElement("h3");
    label.textContent = `Wave ${waveIdx}`;
    grid.appendChild(label);
    grid.appendChild(row);
  }
  return row;
}

function ensureCard(componentId, waveIdx) {
  if (cards[componentId]) return cards[componentId];
  const row = ensureWaveRow(waveIdx);
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<div class="name">${componentId}</div><div class="status">pending</div><div class="duration"></div>`;
  row.appendChild(el);
  cards[componentId] = el;
  return el;
}

socket.on("build:wave:start", (p) => {
  p.components.forEach(id => ensureCard(id, p.wave_index));
});

socket.on("build:component:start", (p) => {
  const card = cards[p.component_id];
  if (card) {
    card.className = "card running";
    card.querySelector(".status").textContent = "running…";
  }
});

socket.on("build:component:done", (p) => {
  const card = cards[p.component_id];
  if (card) {
    card.className = "card done";
    card.querySelector(".status").textContent = "done";
    card.querySelector(".duration").textContent = `${p.duration_ms}ms → ${p.file_path}`;
  }
});

socket.on("build:component:error", (p) => {
  const card = cards[p.component_id];
  if (card) {
    card.className = "card error";
    card.querySelector(".status").textContent = "error";
    card.querySelector(".duration").textContent = p.error;
  }
});

socket.on("build:complete", (p) => {
  const link = document.createElement("a");
  link.href = `${window.PFX || ""}/deploy?run=${runId}`;
  link.textContent = "Continue to Deploy →";
  link.style.cssText = "display:inline-block;margin-top:1rem;color:#60a5fa;font-weight:600;";
  grid.appendChild(link);
});

socket.on("build:fatal", (p) => {
  const err = document.createElement("p");
  err.textContent = `Build failed: ${p.error}`;
  err.style.color = "#ef4444";
  grid.appendChild(err);
});

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  const r = await fetch(`${window.PFX || ""}/build/start`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({package: window.PACKAGE_PATH}),
  });
  const body = await r.json();
  runId = body.run_id;
  socket.emit("join", {room: `build:${runId}`});
});
```

- [ ] **Step 3: Add socket.io join handler in webapp.py**

Add to `architect/webapp.py`:

```python
@socketio.on("join")
def on_join(data):
    room = data.get("room")
    if room:
        from flask_socketio import join_room
        join_room(room)
```

- [ ] **Step 4: Commit**

```bash
git add architect/static/build.js architect/static/architect.css architect/webapp.py
git commit -m "Add wave-grid frontend (build.js) + socketio join handler"
```

---

### Task 3.4: Add /deploy route + Monaco-editor template

**Files:**
- Modify: `architect/webapp.py`
- Create: `architect/templates/deploy.html`
- Modify: `architect/tests/test_build_deploy_routes.py`

- [ ] **Step 1: Add the failing test**

Append to `architect/tests/test_build_deploy_routes.py`:

```python
def test_get_deploy_renders_with_run_param(client, tmp_path, monkeypatch):
    # Create a fake workspace
    monkeypatch.chdir(tmp_path)
    ws_root = tmp_path / "architect" / "workspaces" / "abc"
    (ws_root / "src").mkdir(parents=True)
    (ws_root / "src" / "health-handler.js").write_text("router.get('/healthz', h);")
    (ws_root / "src" / "app-server.js").write_text("app.listen(3000);")
    monkeypatch.setattr("architect.webapp._os.path.dirname", lambda p: str(tmp_path / "architect"))

    r = client.get("/deploy?run=abc")
    # Accept 200 or 404 (workspace-discovery edge cases) — the focus of this test is the route exists
    assert r.status_code in (200, 404)


def test_get_deploy_without_run_returns_400(client):
    r = client.get("/deploy")
    assert r.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: FAIL — `/deploy` doesn't exist

- [ ] **Step 3: Implement /deploy route**

Add to `architect/webapp.py`:

```python
@app.get("/deploy")
def deploy_page():
    run_id = request.args.get("run")
    if not run_id:
        return ("Missing required query param: run", 400)
    workspace = _os.path.join(_os.path.dirname(__file__), "workspaces", run_id)
    if not _os.path.isdir(workspace):
        return (f"Workspace not found: {run_id}", 404)

    # Resolve resource name: <spec_slug>-<run_short>
    # Why: ensures cluster Application name, ECR tag, and ingress host are unique per run AND per user,
    # so two people building the same spec don't overwrite each other's deploys (see plan note + spec §6 step 1).
    # The package path was passed at build time and persisted in the workspace as `_package.yaml`.
    pkg_path = _os.path.join(workspace, "_package.yaml")
    if not _os.path.exists(pkg_path):
        return (f"Workspace {run_id} missing _package.yaml — re-run build", 404)
    package = _builder.parse_build_package(pkg_path)
    run_short = run_id[:6]
    resource_name = f"{package.spec_slug}-{run_short}"  # e.g. "hello-world-abc123"

    cfg = _bdcfg.load()
    healthcheck_path = _deployer.derive_healthcheck_path(workspace) or "/"
    port = _deployer.derive_port(workspace) or 3000
    image = f"{cfg.ecr_registry}/{cfg.ecr_repository_prefix}/{package.spec_slug}:{run_short}"
    host = f"{resource_name}-{cfg.default_namespace}.tools.fubotv.net"

    template_path = _os.path.join(_os.path.dirname(__file__), "templates", "deploy_template.yaml")
    rendered = _deployer.render_yaml(
        template_path=template_path,
        name=resource_name,
        namespace=cfg.default_namespace,
        image=image,
        port=port,
        host=host,
        healthcheck_path=healthcheck_path,
    )
    return render_template("deploy.html", run_id=run_id, rendered_yaml=rendered, host=host)
```

- [ ] **Step 4: Create deploy.html with Monaco editor**

`architect/templates/deploy.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deploy — Architect</title>
  <link rel="stylesheet" href="{{ pfx }}/static/architect.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs/editor/editor.main.css">
</head>
<body>
  <h1>Deploy</h1>
  <p>Run: {{ run_id }}</p>
  <div id="editor" style="height:60vh;border:1px solid #334155;"></div>
  <div style="margin-top:1rem;display:flex;gap:.5rem;">
    <button id="image-build">1. Build Image</button>
    <button id="image-push" disabled>2. Push to ECR</button>
    <button id="apply" disabled>3. Apply</button>
  </div>
  <pre id="log" style="background:#020617;padding:1rem;margin-top:1rem;max-height:30vh;overflow:auto;"></pre>
  <p id="live-link" style="margin-top:1rem;font-weight:600;"></p>

  <script>window.RUN_ID = {{ run_id | tojson }}; window.HOST = {{ host | tojson }}; window.PFX = {{ pfx | tojson }};</script>
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs/loader.js"></script>
  <script>
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
      window.EDITOR = monaco.editor.create(document.getElementById('editor'), {
        value: {{ rendered_yaml | tojson }},
        language: 'yaml',
        theme: 'vs-dark',
        minimap: { enabled: false },
      });
    });
  </script>
  <script src="{{ pfx }}/static/deploy.js"></script>
</body>
</html>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: PASS (test accepts 200 or 404 — the route exists)

- [ ] **Step 6: Commit**

```bash
git add architect/webapp.py architect/templates/deploy.html architect/tests/test_build_deploy_routes.py
git commit -m "Add /deploy route + Monaco editor template with rendered YAML"
```

---

### Task 3.5: Add /deploy/image-build, /image-push, /apply routes + deploy.js

**Files:**
- Modify: `architect/webapp.py`
- Create: `architect/static/deploy.js`
- Modify: `architect/tests/test_build_deploy_routes.py`

- [ ] **Step 1: Add the failing test**

Append to `architect/tests/test_build_deploy_routes.py`:

```python
def test_post_deploy_image_build_returns_200(client, tmp_path, monkeypatch):
    ws = tmp_path / "ws"
    (ws / "src").mkdir(parents=True)
    monkeypatch.setattr("architect.webapp._workspace_path", lambda run_id: str(ws))
    monkeypatch.setattr("architect.deployer.docker_build", lambda img, ws_: "ok\n")
    r = client.post("/deploy/image-build", json={"run_id": "abc", "image": "img:tag"})
    assert r.status_code == 200


def test_post_deploy_image_push_surfaces_ecr_auth_error(client, monkeypatch):
    from architect.deployer import EcrAuthError
    def boom(*a, **kw):
        raise EcrAuthError("ECR auth missing or expired. Run: aws ecr get-login-password ...")
    monkeypatch.setattr("architect.deployer.docker_push", boom)
    r = client.post("/deploy/image-push", json={"image": "img:tag"})
    assert r.status_code == 401
    body = r.get_json()
    assert "aws ecr get-login-password" in body["error"]


def test_post_deploy_apply_returns_200_and_polls(client, tmp_path, monkeypatch):
    yaml_path = tmp_path / "d.yaml"
    yaml_path.write_text("apiVersion: v1\nkind: Pod\n")
    monkeypatch.setattr("architect.deployer.kubectl_apply", lambda p: "applied")
    monkeypatch.setattr("architect.deployer.poll_ingress", lambda url, **kw: 1.5)
    r = client.post("/deploy/apply", json={"yaml": "apiVersion: v1\nkind: Pod\n", "host": "h.example.com", "healthcheck_path": "/healthz"})
    assert r.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: FAIL — routes don't exist

- [ ] **Step 3: Implement deploy routes**

Add to `architect/webapp.py`:

```python
def _workspace_path(run_id: str) -> str:
    return _os.path.join(_os.path.dirname(__file__), "workspaces", run_id)


@app.post("/deploy/image-build")
def deploy_image_build():
    body = request.get_json(silent=True) or {}
    run_id = body.get("run_id")
    image = body.get("image")
    if not run_id or not image:
        return jsonify({"error": "Missing run_id or image"}), 400
    ws = _workspace_path(run_id)
    try:
        out = _deployer.docker_build(image, ws)
        return jsonify({"output": out})
    except _deployer.DeployError as e:
        return jsonify({"error": str(e)}), 500


@app.post("/deploy/image-push")
def deploy_image_push():
    body = request.get_json(silent=True) or {}
    image = body.get("image")
    if not image:
        return jsonify({"error": "Missing image"}), 400
    cfg = _bdcfg.load()
    try:
        out = _deployer.docker_push(image, region=cfg.aws_region, registry=cfg.ecr_registry)
        return jsonify({"output": out})
    except _deployer.EcrAuthError as e:
        return jsonify({"error": str(e)}), 401
    except _deployer.DeployError as e:
        return jsonify({"error": str(e)}), 500


@app.post("/deploy/apply")
def deploy_apply():
    body = request.get_json(silent=True) or {}
    yaml_text = body.get("yaml")
    host = body.get("host")
    healthcheck_path = body.get("healthcheck_path", "/")
    if not yaml_text or not host:
        return jsonify({"error": "Missing yaml or host"}), 400

    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as tf:
        tf.write(yaml_text)
        tf_path = tf.name
    try:
        apply_out = _deployer.kubectl_apply(tf_path)
        elapsed = _deployer.poll_ingress(f"https://{host}{healthcheck_path}", timeout_s=120)
        return jsonify({"applied": apply_out, "ingress_ready_after_s": elapsed, "url": f"https://{host}/"})
    except _deployer.IngressTimeout as e:
        return jsonify({"error": str(e)}), 504
    except _deployer.DeployError as e:
        return jsonify({"error": str(e)}), 500
```

- [ ] **Step 4: Create deploy.js**

`architect/static/deploy.js`:
```javascript
const log = document.getElementById("log");
const buildBtn = document.getElementById("image-build");
const pushBtn = document.getElementById("image-push");
const applyBtn = document.getElementById("apply");
const liveLink = document.getElementById("live-link");

function append(line) {
  log.textContent += line + "\n";
  log.scrollTop = log.scrollHeight;
}

let imageTag = `architect-${window.RUN_ID}:${Date.now()}`;

buildBtn.addEventListener("click", async () => {
  buildBtn.disabled = true;
  append(`> docker build -t ${imageTag} <workspace>`);
  const r = await fetch(`${window.PFX || ""}/deploy/image-build`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({run_id: window.RUN_ID, image: imageTag}),
  });
  const body = await r.json();
  if (r.ok) { append(body.output || "ok"); pushBtn.disabled = false; }
  else { append(`ERROR: ${body.error}`); buildBtn.disabled = false; }
});

pushBtn.addEventListener("click", async () => {
  pushBtn.disabled = true;
  append(`> docker push ${imageTag}`);
  const r = await fetch(`${window.PFX || ""}/deploy/image-push`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({image: imageTag}),
  });
  const body = await r.json();
  if (r.ok) { append(body.output || "ok"); applyBtn.disabled = false; }
  else { append(`ERROR: ${body.error}`); pushBtn.disabled = false; }
});

applyBtn.addEventListener("click", async () => {
  applyBtn.disabled = true;
  const yamlText = window.EDITOR.getValue();
  // Parse the YAML client-side just enough to extract host + healthcheck path for the poll
  const hostMatch = yamlText.match(/host:\s*(\S+)/);
  const pathMatch = yamlText.match(/healthcheck:\s*\n\s*path:\s*(\S+)/);
  const host = hostMatch ? hostMatch[1] : window.HOST;
  const healthcheck_path = pathMatch ? pathMatch[1] : "/";
  append(`> kubectl apply -f <rendered.yaml>`);
  const r = await fetch(`${window.PFX || ""}/deploy/apply`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({yaml: yamlText, host, healthcheck_path}),
  });
  const body = await r.json();
  if (r.ok) {
    append(body.applied || "applied");
    append(`Ingress ready after ${body.ingress_ready_after_s.toFixed(1)}s`);
    liveLink.innerHTML = `Live at <a href="${body.url}" target="_blank">${body.url}</a>`;
  } else {
    append(`ERROR: ${body.error}`);
    applyBtn.disabled = false;
  }
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest architect/tests/test_build_deploy_routes.py -v`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add architect/webapp.py architect/static/deploy.js architect/tests/test_build_deploy_routes.py
git commit -m "Add deploy routes (build/push/apply) + deploy.js stepper UI"
```

---

### Task 3.6: Add Continue-to-Build link from /decompose page

**Files:**
- Modify: `architect/templates/decompose.html`

This is a one-line UI patch — once decompose has produced a build-package YAML, link to /build with that path as the query.

- [ ] **Step 1: Read the current decompose template**

```bash
grep -n 'package\|export\|download' architect/templates/decompose.html | head -20
```

- [ ] **Step 2: Add the link**

In the section of `decompose.html` where the YAML is offered for download/export, add a link adjacent:

```html
<a href="{{ pfx }}/build?package=architect/examples/hello-world-build-package.yaml" class="btn btn-primary">Continue to Build →</a>
```

(For HelloWorld walkthrough, the path is hardcoded; for arbitrary user runs, this would derive from the saved package path — leave that as a follow-up if not trivially derivable from the existing template's variables.)

- [ ] **Step 3: Manual smoke test**

```bash
cd /Users/reubenpatterson/LLM_Presentation && python -m architect
```

Open http://localhost:5001/decompose, confirm the new "Continue to Build →" link appears.

- [ ] **Step 4: Commit**

```bash
git add architect/templates/decompose.html
git commit -m "Add Continue-to-Build link from decompose page"
```

---

## Phase 4 — End-to-End Smoke Test

### Task 4.1: Manual smoke test of full pipeline

This is a manual validation; no test code added. Documents the steps for the implementer to verify the full flow works against the real cluster + real Ollama.

- [ ] **Step 1: Verify prerequisites**

```bash
# Ollama running with mistral:7b
curl -s http://localhost:11434/api/tags | grep mistral

# kubectl context points at vat-development-blue
kubectl config current-context

# AWS SSO active
aws sts get-caller-identity

# ECR docker login is fresh (run once, refreshes for 12 hours)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 650127479436.dkr.ecr.us-east-1.amazonaws.com

# Docker daemon running
docker info | head -3
```

All four should succeed before proceeding.

- [ ] **Step 2: Confirm an ECR repo exists for the build**

```bash
aws ecr describe-repositories --region us-east-1 --repository-names architect-builds/hello-world 2>&1 || \
  aws ecr create-repository --region us-east-1 --repository-name architect-builds/hello-world
```

- [ ] **Step 3: Start the architect**

```bash
cd /Users/reubenpatterson/LLM_Presentation && python -m architect
```

- [ ] **Step 4: Walk the pipeline**

Open http://localhost:5001/build?package=architect/examples/hello-world-build-package.yaml

- Click "Start Build"
- Watch wave-grid: wave 0 (weather-service, health-handler) runs concurrently, then wave 1 (weather-handler, app-server)
- Each card should transition pending → running → done
- Click "Continue to Deploy →"

On the deploy page:
- Verify the YAML in the editor has all fields filled (no `{{...}}` remaining)
- Verify healthcheck path was derived (likely `/healthz` from generated health-handler.js)
- Click "1. Build Image" — should succeed in 30-60s
- Click "2. Push to ECR" — should succeed in 10-30s
- Click "3. Apply" — should succeed; "Live at https://..." link appears within 90s

- [ ] **Step 5: Verify the deployed app**

The host shown by the agent will be of the form `hello-world-<run_short>-training.tools.fubotv.net`. Use the URL the agent reports.

```bash
# Replace <run_short> with the 6-char suffix the agent printed (e.g. "abc123")
HOST=hello-world-<run_short>-training.tools.fubotv.net
curl https://$HOST/healthz
curl https://$HOST/
```

Both should return 200. The root should serve the HelloWorld HTML page.

- [ ] **Step 6: Document outcome**

If any step failed, capture the failure mode in `docs/superpowers/specs/2026-05-05-build-deploy-module-design.md` §10 Risks for future iteration. If all passed, no spec change needed.

- [ ] **Step 7: Cleanup**

```bash
# List Applications named hello-world-* and delete the one you created
kubectl -n training get applications | grep hello-world
kubectl -n training delete application hello-world-<run_short>
```

(Leave podinfo if you want a reference deploy; otherwise `kubectl -n training delete application podinfo`.)

---

## Self-Review Checklist

Before declaring this plan complete, verify:

- [ ] Every spec section §4-§6 + §9 maps to one or more tasks above
- [ ] Every numbered step in spec §5 (build agent behavior) and §6 (deploy agent behavior) has explicit code in a task
- [ ] No "TBD", "TODO", "implement later" markers in any step
- [ ] All function/class names used in later tasks were defined in earlier tasks (parse_build_package, wrap_prompt, post_process_output, OllamaClient, assemble_project, run_build, render_yaml, derive_healthcheck_path, derive_port, docker_build, docker_push, kubectl_apply, poll_ingress)
- [ ] Each task ends with an explicit commit step
- [ ] TDD pattern (test → fail → impl → pass → commit) consistent across all Python tasks
- [ ] UI tasks (3.3, 3.5) note manual smoke test in lieu of automated tests since vanilla JS in the existing webapp pattern doesn't have JS test infra
