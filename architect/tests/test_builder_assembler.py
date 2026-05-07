import os
from architect.builder import assemble_project


def test_javascript_assembly_produces_dockerfile_and_package_json(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "app-server.js").write_text("import express from 'express';\nconst app = express();\napp.listen(3000);\n")
    assemble_project(str(workspace), language="javascript", port=3000, packages=["express", "node-fetch"])

    assert (workspace / "Dockerfile").exists()
    dockerfile = (workspace / "Dockerfile").read_text()
    assert "node:20-alpine" in dockerfile
    assert "EXPOSE 3000" in dockerfile

    pkg = workspace / "package.json"
    assert pkg.exists()
    import json
    pkg_data = json.loads(pkg.read_text())
    assert "express" in pkg_data["dependencies"]
    assert "node-fetch" in pkg_data["dependencies"]
    assert pkg_data["type"] == "module"

    assert (workspace / ".env.example").exists()
    env = (workspace / ".env.example").read_text()
    assert "OPENWEATHER_API_KEY=" in env


def test_python_assembly_produces_dockerfile_and_requirements(tmp_path):
    workspace = tmp_path / "ws"
    (workspace / "src").mkdir(parents=True)
    (workspace / "src" / "app.py").write_text("from flask import Flask\napp = Flask(__name__)\n")
    assemble_project(str(workspace), language="python", port=5000, packages=["flask", "requests"])

    dockerfile = (workspace / "Dockerfile").read_text()
    assert "python:3.12-slim" in dockerfile
    assert "EXPOSE 5000" in dockerfile

    reqs = (workspace / "requirements.txt").read_text()
    assert "flask" in reqs
    assert "requests" in reqs


def test_unknown_language_raises(tmp_path):
    import pytest
    workspace = tmp_path / "ws"
    (workspace / "src").mkdir(parents=True)
    with pytest.raises(ValueError):
        assemble_project(str(workspace), language="rust", port=8080, packages=[])


def test_javascript_assembly_writes_app_server_shim_when_missing(tmp_path):
    """assemble_project auto-emits a default app-server.js if no entry-point exists.
    Decompose-output build-packages typically don't include an `app-server` component,
    so the Dockerfile's `node src/app-server.js` CMD has nothing to run without this."""
    workspace = tmp_path / "ws"
    (workspace / "src").mkdir(parents=True)
    (workspace / "src" / "weather-handler.js").write_text("export default {};")
    assemble_project(str(workspace), language="javascript", port=3000, packages=["express"])

    shim = workspace / "src" / "app-server.js"
    assert shim.exists(), "app-server.js shim must be written when missing"
    content = shim.read_text()
    assert "/healthz" in content, "shim must expose /healthz for the K8s probe"
    assert "PORT" in content, "shim must listen on PORT"
    assert "import('./" in content or "import './" in content, "shim must auto-import sibling routers"


def test_javascript_assembly_preserves_existing_app_server(tmp_path):
    """If the build agent already generated app-server.js, assemble_project must NOT overwrite it."""
    workspace = tmp_path / "ws"
    (workspace / "src").mkdir(parents=True)
    custom = "// hand-written app-server\nimport express from 'express';\n"
    (workspace / "src" / "app-server.js").write_text(custom)
    assemble_project(str(workspace), language="javascript", port=3000, packages=["express"])

    assert (workspace / "src" / "app-server.js").read_text() == custom


def test_safe_filename_sanitizes_spaces_and_special_chars():
    from architect.builder import _safe_filename
    assert _safe_filename("simple-name") == "simple-name"
    assert _safe_filename("city entity with name-model") == "city-entity-with-name-model"
    assert _safe_filename(":id update task status or assignee-handler") == "id-update-task-status-or-assignee-handler"
    assert _safe_filename("UPPER_Case") == "upper_case"
    assert _safe_filename("") == "component"
