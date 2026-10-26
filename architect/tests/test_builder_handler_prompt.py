"""Regression: run b6cb0a5da5c8's WeatherHandler prompt carried none of the spec's behaviour (no
response shape, no OpenWeather URL, no key rule), said "Runtime: Node 20" for a Python build, and
told the model to import an IWeatherService that no generated file provides. gemma4:e4b answered
with a mock service and hard-coded cities. The fixed prompt below was sent to the box's gemma4:e4b
(think:false, 2026-10-26) and its answer is fixture weather-handler-v2.py.txt."""
import copy
import hashlib
from pathlib import Path

from architect.builder import parse_build_package, run_build, wrap_prompt

FIX = Path(__file__).parent / "fixtures" / "build_run1"
VALIDATED_PROMPT_SHA256 = "9683f129f466b7600715cfb7e4ef271eac1fba8b33c378bc5722b701a93a5043"


def _pkg():
    return parse_build_package(str(FIX / "build-package.yaml"))


def _comp(pkg, component_id):
    return next(c for wave in pkg.waves for c in wave if c["id"] == component_id)


def _augmented_spec(pkg):
    """The run-1 spec plus the 5 lines the old intake dedupe dropped (box replay, 2026-10-26)."""
    spec = copy.deepcopy(pkg.spec)
    spec["api"][1:1] = [
        "GET / serves the single-page HTML with a city input defaulting to New York and a 'Get weather' button.",
        "GET /healthz returns status 200.",
    ]
    spec["error_handling"] += [
        '404: {"error": "city not found"} when OpenWeather returns 404.',
        '502: {"error": "weather service unavailable"} on upstream failure or timeout.',
        '500: {"error": "OPENWEATHER_API_KEY not set"} if the environment variable is absent.',
    ]
    return spec


def _prompt(component_id, spec=None, pkg=None):
    pkg = pkg or _pkg()
    return wrap_prompt(
        _comp(pkg, component_id),
        language="python",
        runtime="Python 3.12",
        allowed_packages=["flask", "requests"],
        target_relpath=f"src/{component_id}.py",
        spec=pkg.spec if spec is None else spec,
    )


def test_handler_prompt_carries_spec_behaviour():
    p = _prompt("weather-handler")
    assert "Application spec (this file must implement all of it):\nPurpose:\n" in p
    for line in [
        '- Success response (200): JSON {"city": str, "temp_f": number, "description": str}',
        "- External dependency: OpenWeather API using URL format: https://api.openweathermap.org/data/2.5/weather?q=<city>&appid=<key>&units=imperial",
        "- Config comes from the env var OPENWEATHER_API_KEY and is never hard-coded",
        "- Upstream call must have a 5s timeout limit.",
    ]:
        assert line in p


def test_handler_prompt_drops_spec_noise_and_import_lines():
    p = _prompt("weather-handler")
    assert "PoC scope —" not in p
    assert "Not required / out of scope" not in p
    assert "Depends on (import, do not implement)" not in p
    assert "IWeatherService" not in p


def test_handler_prompt_has_python_and_handler_rules():
    p = _prompt("weather-handler")
    assert "\nRules for this file:\n- The app shell loads this file on its own. Other generated files cannot be imported." in p
    assert "- The app shell already serves GET /healthz. Do not define it.\n" in p
    assert "a GET fetch() has no body." in p
    assert p.endswith("\n\nProduce src/weather-handler.py now.")


def test_python_handler_shape_is_complete_and_has_no_stub_markers():
    p = _prompt("weather-handler")
    shape = p.split("File shape (mimic this exactly):\n", 1)[1].split("\n\nComponent purpose:", 1)[0]
    assert "@bp.get('/')" in shape
    assert "fetch('/api/items?name=' + encodeURIComponent(name))" in shape
    assert "timeout=5" in shape
    for marker in ("TODO", "placeholder", "'result': 'value'"):
        assert marker not in shape


def test_handler_prompt_matches_validated_prompt_bytes():
    p = _prompt("weather-handler", spec=_augmented_spec(_pkg()))
    assert hashlib.sha256(p.encode("utf-8")).hexdigest() == VALIDATED_PROMPT_SHA256


def test_service_prompt_gets_rules_but_no_spec_excerpt():
    p = _prompt("weather-service")
    assert "Other generated files cannot be imported." in p
    assert "no TODO comments" in p
    assert "Application spec (this file must implement all of it):" not in p
    assert "The app shell already serves GET /healthz" not in p
    assert "Depends on (import, do not implement)" not in p


def test_test_component_prompt_has_no_self_contained_rule():
    p = _prompt("weather-test-suite")
    assert "Other generated files cannot be imported." not in p
    assert "no TODO comments" in p
    assert "Application spec (this file must implement all of it):" not in p


def test_javascript_prompt_has_no_python_rules():
    comp = {"id": "h", "type": "handler", "constraints": [],
            "prompt": "x\nDepends on (import, do not implement): IFoo"}
    p = wrap_prompt(comp, language="javascript", runtime="Node 20", allowed_packages=["express"],
                    target_relpath="src/h.js", spec={"api": ["GET /x"]})
    assert "Rules for this file:" not in p
    assert "Application spec" not in p
    assert "Depends on (import, do not implement): IFoo" in p


def test_run_build_defaults_runtime_from_language(tmp_path):
    prompts = []

    class _Rec:
        def generate(self, prompt):
            prompts.append(prompt)
            return "import os\n"

    ws = tmp_path / "ws"
    ws.mkdir()
    run_build(package_path=str(FIX / "build-package.yaml"), workspace=str(ws), ollama=_Rec(),
              emit=lambda e, p: None)
    assert len(prompts) == 6
    assert all("\nRuntime: Python 3.12\n" in p for p in prompts)
    assert not any("Node 20" in p for p in prompts)
