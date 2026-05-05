import pytest
from architect.webapp import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_get_build_renders_with_package_param(client):
    r = client.get("/build?package=architect/examples/hello-world-build-package.yaml")
    assert r.status_code == 200
    assert b"build" in r.data.lower()


def test_get_build_without_package_returns_400(client):
    r = client.get("/build")
    assert r.status_code == 400


import os
from unittest.mock import patch


def test_post_build_start_returns_run_id(client, tmp_path):
    pkg = tmp_path / "p.yaml"
    pkg.write_text("metadata: {name: hi, total_components: 0, total_waves: 0, max_parallelism: 1}\nspec: {tech_stack: [\"Language: JavaScript\"]}\ndag: {}\n")
    with patch("architect.webapp.socketio.start_background_task") as bt:
        r = client.post("/build/start", json={"package": str(pkg)})
    assert r.status_code == 200
    body = r.get_json()
    assert "run_id" in body
    bt.assert_called_once()


def test_post_build_start_rejects_missing_package(client):
    r = client.post("/build/start", json={})
    assert r.status_code == 400
