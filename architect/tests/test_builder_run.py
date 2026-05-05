import os
import textwrap
from unittest.mock import MagicMock
from architect.builder import run_build, parse_build_package


PACKAGE_YAML = textwrap.dedent("""
metadata:
  name: hello-world
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
