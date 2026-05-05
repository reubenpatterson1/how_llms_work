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
