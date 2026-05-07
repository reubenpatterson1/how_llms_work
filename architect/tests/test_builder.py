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


def test_parse_derives_name_from_objective_when_metadata_name_missing(tmp_path):
    """No metadata.name -> derive from spec.purpose 'Objective:' line."""
    import textwrap
    pkg = textwrap.dedent('''
metadata:
  total_components: 1
  total_waves: 1
  max_parallelism: 1
spec:
  tech_stack:
    - "Language: JavaScript"
  purpose:
    - "Objective: Ship a team task tracker for engineering teams"
dag:
  c1: {name: c1, type: handler, wave: 0, complexity: low, constraints: [], prompt: "p"}
''')
    path = tmp_path / "no-name.yaml"
    path.write_text(pkg)
    result = parse_build_package(str(path))
    # "Ship" is a stop word, so the first 4 kept words are: team, task, tracker, engineering
    assert result.spec_slug == "team-task-tracker-engineering"


def test_parse_defaults_to_app_slug_when_no_name_or_objective(tmp_path):
    """No metadata.name and no Objective in purpose -> default 'app'."""
    import textwrap
    pkg = textwrap.dedent('''
metadata:
  total_components: 1
  total_waves: 1
  max_parallelism: 1
spec:
  tech_stack:
    - "Language: Python"
dag:
  c1: {name: c1, type: handler, wave: 0, complexity: low, constraints: [], prompt: "p"}
''')
    path = tmp_path / "barebones.yaml"
    path.write_text(pkg)
    result = parse_build_package(str(path))
    assert result.spec_slug == "app"
