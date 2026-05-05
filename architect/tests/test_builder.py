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
