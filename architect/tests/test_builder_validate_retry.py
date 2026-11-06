"""Builder self-check: Python output must parse and must not carry the stub markers the plan's
Task 2.2 Step 5 greps for. A rejected output gets exactly one retry with the reason appended."""
import textwrap

import pytest

from architect.builder import OllamaError, run_build, validate_generated_code

PY_PKG = textwrap.dedent("""
    metadata:
      name: retry-app
      max_parallelism: 1
    spec:
      tech_stack:
        - "Python 3.12"
    dag:
      thing-service:
        type: service
        wave: 0
        constraints: []
        prompt: "p"
""")


class _ScriptedOllama:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.prompts = []

    def generate(self, prompt):
        self.prompts.append(prompt)
        return self.outputs.pop(0)


def _run(tmp_path, ollama):
    pkg = tmp_path / "pkg.yaml"
    pkg.write_text(PY_PKG)
    ws = tmp_path / "ws"
    ws.mkdir()
    events = []
    run_build(package_path=str(pkg), workspace=str(ws), ollama=ollama,
              emit=lambda e, p: events.append((e, p)))
    return ws, events


def _payloads(events, name):
    return [p for e, p in events if e == name]


def test_validate_python_reports_syntax_error_with_line():
    reason = validate_generated_code("x = 1\ndef f(:\n    pass\n", "python")
    assert reason.startswith("SyntaxError: ")
    assert "(line 2)" in reason


@pytest.mark.parametrize("code, marker", [
    ("x = 1  # TODO wire this\n", "TODO"),
    ("# a placeholder function\nx = 1\n", "placeholder"),
    ('def h():\n    return {"result": "value"}\n', '{"result": "value"}'),
    ("def h():\n    return {'result': 'value'}\n", "{'result': 'value'}"),
])
def test_validate_python_rejects_stub_markers(code, marker):
    reason = validate_generated_code(code, "python")
    assert reason is not None
    assert marker in reason


def test_validate_python_accepts_clean_code():
    assert validate_generated_code("import os\n\nSEP = os.sep\n", "python") is None


def test_validate_skips_non_python():
    assert validate_generated_code("const x = ;  // TODO", "javascript") is None


def test_rejected_output_is_retried_once_with_reason(tmp_path):
    ollama = _ScriptedOllama(["def f(:\n    pass\n", "def f():\n    return 1\n"])
    ws, events = _run(tmp_path, ollama)
    assert len(ollama.prompts) == 2
    assert ollama.prompts[1].startswith(ollama.prompts[0] + "\n\nYour previous output was rejected: SyntaxError: ")
    assert ollama.prompts[1].endswith(". Output the complete corrected file now, following every instruction above.")
    assert (ws / "src" / "thing-service.py").read_text() == "def f():\n    return 1\n"
    assert [p["attempts"] for p in _payloads(events, "build:component:done")] == [2]
    assert _payloads(events, "build:component:error") == []


def test_two_rejected_outputs_fail_component_without_writing_file(tmp_path):
    ollama = _ScriptedOllama(["def f(:\n", "# placeholder\nx = 1\n"])
    ws, events = _run(tmp_path, ollama)
    assert len(ollama.prompts) == 2
    assert not (ws / "src" / "thing-service.py").exists()
    errors = _payloads(events, "build:component:error")
    assert len(errors) == 1
    assert errors[0]["component_id"] == "thing-service"
    assert errors[0]["attempts"] == 2
    assert "placeholder" in errors[0]["error"]
    assert events[-1][0] == "build:complete"


def test_clean_first_output_calls_model_once(tmp_path):
    ollama = _ScriptedOllama(["import os\n"])
    ws, events = _run(tmp_path, ollama)
    assert len(ollama.prompts) == 1
    assert [p["attempts"] for p in _payloads(events, "build:component:done")] == [1]


def test_prose_output_is_retried_once(tmp_path):
    ollama = _ScriptedOllama(["Sure! Here is the file.", "import os\n"])
    ws, events = _run(tmp_path, ollama)
    assert len(ollama.prompts) == 2
    assert "Your previous output was rejected: LLM output looks like prose" in ollama.prompts[1]
    assert (ws / "src" / "thing-service.py").exists()


def test_ollama_error_is_not_retried(tmp_path):
    class _Down:
        calls = 0

        def generate(self, prompt):
            _Down.calls += 1
            raise OllamaError("Ollama request failed: down")

    ws, events = _run(tmp_path, _Down())
    assert _Down.calls == 1
    errors = _payloads(events, "build:component:error")
    assert len(errors) == 1
    assert errors[0]["attempts"] == 1


def test_retry_reason_names_placeholder_attribute_and_todo_names(tmp_path):
    ollama = _ScriptedOllama(['import os\nPAGE = \'<input placeholder="City">\'\n', "import os\n"])
    _run(tmp_path, ollama)
    assert len(ollama.prompts) == 2
    assert ("the word 'placeholder' is forbidden anywhere in the file, including the HTML placeholder= "
            "attribute; set the default with value= instead and do not use the word") in ollama.prompts[1]
    ollama = _ScriptedOllama(["import os\nTODOS = []\n", "import os\n"])
    (tmp_path / "second").mkdir()
    _run(tmp_path / "second", ollama)
    assert len(ollama.prompts) == 2
    assert ("the text 'TODO' is forbidden anywhere in the file, including names such as TODOS and titles; "
            "rename it") in ollama.prompts[1]
