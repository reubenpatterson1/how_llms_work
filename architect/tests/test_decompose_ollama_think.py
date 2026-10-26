"""Regression: Decompose on gemma4:e4b must not lose its output budget to hidden thinking.

Bug (live run 2026-10-26 15:16:59Z-15:17:48Z): query_ollama sent no "think" field, so
gemma4:e4b (Ollama capability "thinking") reasoned before answering. The reasoning
consumed part of num_predict=2048, the visible JSON was cut off mid-object
(Ollama eval_count=2048), _parse_llm_response failed, and Decompose fell back to the
regex extractor (AuthService/AuthMiddleware, no weather component).

The fake Ollama below reproduces that: unless the request carries "think": false it
returns the real captured response truncated to the 2899 chars seen in the live log,
with done_reason="length".
"""

from pathlib import Path

import pytest

import architect.llm_judge as llm_judge
from architect.decomposer import DecompositionEngine
from architect.llm_judge import (
    ProjectPhase,
    ProviderConfig,
    ProviderType,
    QUERY_FUNCTIONS,
    query_ollama,
)

FIXTURES = Path(__file__).parent / "fixtures"
WEATHER_SPEC = (FIXTURES / "weather_t4_spec.md").read_text(encoding="utf-8")
GOOD_RESPONSE = (FIXTURES / "weather_decompose_gemma4_e4b_think_false.txt").read_text(encoding="utf-8")
LIVE_TRUNCATED_LEN = 2899


class _FakeResponse:
    status_code = 200

    def __init__(self, body):
        self._body = body

    def json(self):
        return self._body


@pytest.fixture
def ollama_cfg():
    return ProviderConfig(
        type=ProviderType.OLLAMA,
        model="gemma4:e4b",
        base_url="http://ollama.invalid:11434",
        temperature=0.1,
        max_tokens=2048,
        timeout=170,
    )


@pytest.fixture
def fake_ollama(monkeypatch):
    """Patch requests.post in llm_judge; record every JSON payload sent."""
    sent = []

    def _post(url, json=None, timeout=None, **kwargs):
        sent.append(json)
        if json.get("think") is False:
            return _FakeResponse({"response": GOOD_RESPONSE, "done_reason": "stop", "eval_count": 1034})
        return _FakeResponse({"response": GOOD_RESPONSE[:LIVE_TRUNCATED_LEN], "done_reason": "length", "eval_count": 2048})

    monkeypatch.setattr(llm_judge.requests, "post", _post)
    return sent


def _names(plan):
    return [c.name for w in plan.waves for c in w.components]


def _components(plan):
    return [c for w in plan.waves for c in w.components]


def test_decompose_ollama_request_sends_think_false(ollama_cfg, fake_ollama):
    engine = DecompositionEngine(phase=ProjectPhase.POC, llm_config=ollama_cfg)
    engine.decompose(WEATHER_SPEC)
    assert len(fake_ollama) == 1
    assert fake_ollama[0]["think"] is False


def test_query_ollama_default_payload_has_no_think_key(ollama_cfg, fake_ollama):
    query_ollama(ollama_cfg, "intake prompt", system_prompt="intake system")
    assert len(fake_ollama) == 1
    assert "think" not in fake_ollama[0]


def test_decompose_non_ollama_provider_gets_no_think_kwarg(monkeypatch):
    calls = []

    def _fake_openai(config, prompt, system_prompt=""):
        calls.append(prompt)
        return {
            "components": [{"id": "weather-service", "name": "WeatherService", "type": "service", "channels": []}],
            "dependencies": [],
        }

    monkeypatch.setitem(QUERY_FUNCTIONS, ProviderType.OPENAI, _fake_openai)
    cfg = ProviderConfig(type=ProviderType.OPENAI, model="gpt-4o-mini", api_key="x")
    engine = DecompositionEngine(phase=ProjectPhase.POC, llm_config=cfg)
    plan = engine.decompose(WEATHER_SPEC)
    assert len(calls) == 1
    assert engine.method_used == "openai:gpt-4o-mini"
    assert _names(plan) == ["WeatherService"]


def test_weather_spec_decompose_uses_llm_and_yields_weather_plan(ollama_cfg, fake_ollama, capsys):
    engine = DecompositionEngine(phase=ProjectPhase.POC, llm_config=ollama_cfg)
    plan = engine.decompose(WEATHER_SPEC)
    err = capsys.readouterr().err
    comps = _components(plan)
    names = _names(plan)

    assert engine.method_used == "ollama:gemma4:e4b"
    assert "falling back to regex" not in err
    assert "removed all components" not in err
    assert not [n for n in names if n.startswith("Auth")]
    assert [c for c in comps if c.component_type == "service" and "weather" in c.name.lower()]
    assert [c for c in comps if c.component_type == "handler"]
    assert [c for c in comps if "config" in c.name.lower()]
    assert [c for c in comps if c.component_type == "test"]


def test_api_decompose_route_weather_spec_poc(ollama_cfg, fake_ollama, monkeypatch):
    import architect.webapp as webapp

    monkeypatch.setattr(webapp, "_global_config", ollama_cfg)
    webapp.app.config["TESTING"] = True
    with webapp.app.test_client() as client:
        r = client.post("/api/decompose", json={"spec_text": WEATHER_SPEC, "phase": "poc"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["ok"] is True
    names = [c["name"] for w in body["wave_plan"]["waves"] for c in w["components"]]
    assert not [n for n in names if n.startswith("Auth")]
    assert [n for n in names if "weather" in n.lower()]
    assert fake_ollama[0]["think"] is False


def test_query_ollama_logs_truncation_when_done_reason_length(ollama_cfg, monkeypatch, capsys):
    monkeypatch.setattr(
        llm_judge.requests, "post",
        lambda url, json=None, timeout=None, **kw: _FakeResponse(
            {"response": GOOD_RESPONSE[:LIVE_TRUNCATED_LEN], "done_reason": "length", "eval_count": 2048}),
    )
    assert query_ollama(ollama_cfg, "p", system_prompt="s") is None
    err = capsys.readouterr().err
    assert "done_reason=length" in err
    assert "eval_count=2048" in err
    assert "num_predict=2048" in err


def test_query_ollama_no_truncation_log_when_done_reason_stop(ollama_cfg, monkeypatch, capsys):
    monkeypatch.setattr(
        llm_judge.requests, "post",
        lambda url, json=None, timeout=None, **kw: _FakeResponse(
            {"response": GOOD_RESPONSE, "done_reason": "stop", "eval_count": 1034}),
    )
    assert query_ollama(ollama_cfg, "p", system_prompt="s") is not None
    assert "done_reason=length" not in capsys.readouterr().err
