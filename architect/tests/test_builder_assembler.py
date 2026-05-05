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
