"""Run b6cb0a5da5c8: weather-test-suite imports pytest, but requirements.txt was only flask, requests."""
import textwrap
from pathlib import Path

from architect.builder import run_build

FIX = Path(__file__).parent / "fixtures" / "build_run1"


class _Rec:
    def __init__(self):
        self.prompts = []

    def generate(self, prompt):
        self.prompts.append(prompt)
        return "import os\n"


def _build(tmp_path, pkg_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    ollama = _Rec()
    run_build(package_path=str(pkg_path), workspace=str(ws), ollama=ollama, emit=lambda e, p: None)
    return ws, ollama


def test_python_requirements_include_pytest_when_package_has_test_component(tmp_path):
    ws, _ = _build(tmp_path, FIX / "build-package.yaml")
    assert (ws / "requirements.txt").read_text().splitlines() == ["flask", "requests", "pytest"]


def test_python_requirements_unchanged_without_test_component(tmp_path):
    pkg = tmp_path / "pkg.yaml"
    pkg.write_text(textwrap.dedent("""
        metadata: {name: no-tests, max_parallelism: 1}
        spec: {tech_stack: ["Python 3.12"]}
        dag:
          thing-service: {type: service, wave: 0, constraints: [], prompt: "p"}
    """))
    ws, _ = _build(tmp_path, pkg)
    assert (ws / "requirements.txt").read_text().splitlines() == ["flask", "requests"]


def test_only_test_component_prompt_lists_pytest(tmp_path):
    _, ollama = _build(tmp_path, FIX / "build-package.yaml")
    by_target = {p.split("Target file: ", 1)[1].split("\n", 1)[0]: p for p in ollama.prompts}
    assert "Allowed packages (already installed): flask, requests, pytest\n" in by_target["src/weather-test-suite.py"]
    assert "Allowed packages (already installed): flask, requests\n" in by_target["src/weather-handler.py"]
