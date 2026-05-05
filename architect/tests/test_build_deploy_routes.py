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
