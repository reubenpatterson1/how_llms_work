"""Regression: intake answer 03-api (run 1, 2026-10-26) lost GET /, GET /healthz and the
404/502/500 codes, because LLMJudge._parse_updates kept only the first update per (channel, sub)
in each answer. RAW_UPDATES is gemma4:e4b's real answer to that intake prompt (replayed once on
the box: think unset, done_reason=stop, eval_count=1328). It has 9 updates, and the old code kept 5."""
import architect.llm_judge as llm_judge
from architect.channels import ChannelRegistry
from architect.llm_judge import LLMJudge, ProjectPhase, ProviderConfig, ProviderType
from architect.spec_generator import SpecGenerator

RAW_UPDATES = [
    {"channel": "api", "sub": "endpoints", "resolution": 0.9,
     "constraint": "GET /api/weather?city=<name> is the main endpoint."},
    {"channel": "api", "sub": "response_shapes", "resolution": 0.8,
     "constraint": 'Success response (200) must be JSON: {"city": str, "temp_f": number, "description": str}.'},
    {"channel": "api", "sub": "endpoints", "resolution": 0.7,
     "constraint": "GET / serves the single-page HTML with a city input defaulting to New York and a 'Get weather' button."},
    {"channel": "api", "sub": "endpoints", "resolution": 0.8,
     "constraint": "GET /healthz returns status 200."},
    {"channel": "error_handling", "sub": "taxonomy", "resolution": 0.9,
     "constraint": '400: {"error": "city is required"} if city is missing or empty.'},
    {"channel": "error_handling", "sub": "taxonomy", "resolution": 0.9,
     "constraint": '404: {"error": "city not found"} when OpenWeather returns 404.'},
    {"channel": "error_handling", "sub": "taxonomy", "resolution": 0.9,
     "constraint": '502: {"error": "weather service unavailable"} on upstream failure or timeout.'},
    {"channel": "error_handling", "sub": "taxonomy", "resolution": 0.9,
     "constraint": '500: {"error": "OPENWEATHER_API_KEY not set"} if the environment variable is absent.'},
    {"channel": "performance", "sub": "optimization", "resolution": 0.8,
     "constraint": "Upstream OpenWeather call must have a 5s timeout."},
]


def _judge(registry=None):
    return LLMJudge(registry or ChannelRegistry(), phase=ProjectPhase.POC)


def _section(spec, title):
    return spec.split(f"## {title}\n", 1)[1].split("\n## ", 1)[0]


def test_parse_updates_keeps_every_update_for_the_same_sub():
    updates = _judge()._parse_updates(RAW_UPDATES)
    assert len(updates) == 9
    keys = [(u.channel_id, u.sub_dimension) for u in updates]
    assert keys.count(("api", "endpoints")) == 3
    assert keys.count(("error_handling", "taxonomy")) == 4


def test_parse_updates_still_drops_unknown_subs_and_exact_repeats():
    raw = RAW_UPDATES[:1] + [dict(RAW_UPDATES[0])] + [
        {"channel": "api", "sub": "status_codes", "resolution": 0.9, "constraint": "x"},
        {"channel": "nope", "sub": "endpoints", "resolution": 0.9, "constraint": "y"},
    ]
    updates = _judge()._parse_updates(raw)
    assert [(u.channel_id, u.sub_dimension, u.constraint) for u in updates] == [
        ("api", "endpoints", "GET /api/weather?city=<name> is the main endpoint.")]


def test_dense_spec_keeps_root_page_healthz_and_all_status_codes():
    registry = ChannelRegistry()
    for u in _judge(registry)._parse_updates(RAW_UPDATES):
        registry.update_resolution(u.channel_id, u.sub_dimension, u.resolution, u.constraint)
    spec = SpecGenerator(registry).generate()
    api = _section(spec, "API")
    assert "- GET / serves the single-page HTML with a city input defaulting to New York and a 'Get weather' button." in api
    assert "- GET /healthz returns status 200." in api
    errors = _section(spec, "Error Handling")
    for code in ("400:", "404:", "502:", "500:"):
        assert f"- {code}" in errors


def test_analyze_returns_all_updates_from_provider(monkeypatch):
    cfg = ProviderConfig(type=ProviderType.OLLAMA, model="gemma4:e4b", base_url="http://ollama.invalid:11434")
    monkeypatch.setitem(llm_judge.QUERY_FUNCTIONS, ProviderType.OLLAMA,
                        lambda config, prompt, system_prompt="": {"updates": RAW_UPDATES, "ambiguities": []})
    judge = LLMJudge(ChannelRegistry(), config=cfg, phase=ProjectPhase.POC)
    updates, ambiguities, method = judge.analyze("answer text")
    assert method == "ollama:gemma4:e4b"
    assert len(updates) == 9
