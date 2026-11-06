"""Replay of build run b6cb0a5da5c8 through the Builder with recorded model outputs: the run's own
files for 5 components, plus gemma4:e4b's real answer to the fixed handler prompt. Checks the plan's
Task 2.2 Step 5 grep, the Step 6 import smoke (200 / 400-or-500 / 500) and the Task 2.4 Step 2 page
checks in-process, with no network."""
import importlib.util
import re
import sys
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests

from architect.builder import run_build

FIX = Path(__file__).parent / "fixtures" / "build_run1"
OUTPUTS = {
    "src/api-config.py": "api-config.py.txt",
    "src/weather-middleware.py": "weather-middleware.py.txt",
    "src/weather-service.py": "weather-service.py.txt",
    "src/openweather-api-client.py": "openweather-api-client.py.txt",
    "src/weather-test-suite.py": "weather-test-suite.py.txt",
    "src/weather-handler.py": "weather-handler-v2.py.txt",
}
STEP5_STUB_RE = re.compile(r'\{"result": ?"value"\}|TODO|placeholder')


class _RecordedOllama:
    def __init__(self):
        self.calls = []

    def generate(self, prompt):
        target = re.search(r"^Target file: (\S+)$", prompt, re.M).group(1)
        self.calls.append(target)
        return (FIX / OUTPUTS[target]).read_text(encoding="utf-8")


@pytest.fixture(autouse=True)
def _isolate_imports(monkeypatch):
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)
    saved_path = list(sys.path)
    saved_modules = set(sys.modules)
    saved_bytecode_flag = sys.dont_write_bytecode
    yield
    for name in list(sys.modules):
        if name not in saved_modules and (name.startswith("_arch_component_") or name.startswith("_shim_")):
            del sys.modules[name]
    sys.path[:] = saved_path
    sys.dont_write_bytecode = saved_bytecode_flag


@pytest.fixture
def built(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    events = []
    ollama = _RecordedOllama()
    run_build(package_path=str(FIX / "build-package.yaml"), workspace=str(ws), ollama=ollama,
              emit=lambda e, p: events.append((e, p)))
    return ws, events, ollama


def _client(ws):
    path = ws / "src" / "app.py"
    mod_name = "_shim_" + uuid.uuid4().hex
    spec = importlib.util.spec_from_file_location(mod_name, str(path))
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    spec.loader.exec_module(module)
    return module.app.test_client()


def _resp(status, body):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body
    return r


def test_replay_strips_token_and_rejects_stub_text(built):
    ws, events, ollama = built
    src = ws / "src"
    for name in ("api-config", "weather-middleware", "weather-service", "weather-handler"):
        text = (src / f"{name}.py").read_text(encoding="utf-8")
        assert "<unused" not in text
        compile(text, name, "exec")
    assert not (src / "openweather-api-client.py").exists()
    assert not (src / "weather-test-suite.py").exists()
    errors = {p["component_id"]: p for e, p in events if e == "build:component:error"}
    assert sorted(errors) == ["openweather-api-client", "weather-test-suite"]
    for payload in errors.values():
        assert payload["attempts"] == 2
        assert "placeholder" in payload["error"]
    assert ollama.calls.count("src/openweather-api-client.py") == 2
    assert ollama.calls.count("src/weather-handler.py") == 1


def test_replay_src_passes_plan_step5_grep(built):
    ws, _, _ = built
    texts = {f.name: f.read_text(encoding="utf-8") for f in (ws / "src").iterdir() if f.is_file()}
    assert "app.py" in texts and "weather-handler.py" in texts
    assert {n: STEP5_STUB_RE.findall(t) for n, t in texts.items() if STEP5_STUB_RE.search(t)} == {}
    assert any("openweathermap.org/data/2.5/weather" in t for t in texts.values())


def test_replay_import_smoke_matches_plan_step6(built):
    c = _client(built[0])
    assert c.get("/healthz").status_code == 200
    assert c.get("/api/weather").status_code in (400, 500)
    assert c.get("/api/weather?city=X").status_code == 500


def test_replay_root_is_generated_page_not_shim_fallback(built):
    html = _client(built[0]).get("/").get_data(as_text=True)
    assert "Get weather" in html
    assert "<input" in html
    assert 'id="clock"' not in html


def test_replay_weather_route_follows_openweather_contract(built, monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    c = _client(built[0])
    ok = _resp(200, {"name": "Chicago", "main": {"temp": 51.2}, "weather": [{"description": "clear sky"}]})
    with patch("requests.get", return_value=ok) as get:
        r = c.get("/api/weather?city=chicago")
    assert r.status_code == 200
    assert r.get_json() == {"city": "Chicago", "temp_f": 51.2, "description": "clear sky"}
    assert get.call_args.args[0] == "https://api.openweathermap.org/data/2.5/weather"
    assert get.call_args.kwargs["params"] == {"q": "chicago", "appid": "test-key", "units": "imperial"}
    assert get.call_args.kwargs["timeout"] == 5
    with patch("requests.get", return_value=_resp(404, {"cod": "404", "message": "city not found"})):
        r = c.get("/api/weather?city=zzzznotacity")
    assert (r.status_code, r.get_json()) == (404, {"error": "city not found"})
    with patch("requests.get", side_effect=requests.Timeout()):
        r = c.get("/api/weather?city=x")
    assert (r.status_code, r.get_json()) == (502, {"error": "weather service unavailable"})
