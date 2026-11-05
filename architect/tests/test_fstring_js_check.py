"""Builder self-check: an f-string holding HTML/JavaScript must not use a JS template literal ${...}
(Python reads it as a variable and the page raises NameError). Flagged output gets the one F2 retry."""
import pathlib
import textwrap

from architect.builder import _PY_HANDLER_RULES, find_js_template_in_fstring

from architect.tests.test_builder_validate_retry import _ScriptedOllama, _run

BAD = 'def page(data):\n    return f"""<script>const t = `${data.city}`;</script>"""\n'
FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "build_run3" / "healthz_handler_fstring_js.py.txt"


def test_flags_js_template_literal_in_fstring_with_line():
    assert find_js_template_in_fstring(BAD) == [2]


def test_plain_triple_quoted_string_is_not_flagged():
    src = 'def page():\n    return """<script>const t = `${data.city}`;</script>"""\n'
    assert find_js_template_in_fstring(src) == []


def test_escaped_braces_without_dollar_not_flagged():
    src = 'def page(x):\n    return f"""<script>function f() {{ return `{x}`; }}</script>"""\n'
    assert find_js_template_in_fstring(src) == []


def test_dollar_amount_fstring_not_flagged():
    assert find_js_template_in_fstring('amount = 3\ns = f"Total: ${amount}"\n') == []


def test_invalid_source_returns_empty():
    assert find_js_template_in_fstring("def f(:\n") == []


def test_flagged_output_is_retried_once_with_fstring_reason(tmp_path):
    ollama = _ScriptedOllama([BAD, "def f():\n    return 1\n"])
    ws, events = _run(tmp_path, ollama)
    assert len(ollama.prompts) == 2
    reason = ollama.prompts[1][len(ollama.prompts[0]):]
    assert "Line 2: HTML/JavaScript is inside an f-string" in reason
    assert "f-string" in reason
    assert (ws / "src" / "thing-service.py").read_text() == "def f():\n    return 1\n"


def test_real_failing_fixture_is_flagged():
    lines = FIXTURE.read_text().splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("import "))
    assert find_js_template_in_fstring("\n".join(lines[start:]) + "\n") != []


def test_handler_rules_include_fstring_rule():
    assert any(r.startswith("Never build HTML pages with f-strings.") and "marker" in r
               for r in _PY_HANDLER_RULES)
