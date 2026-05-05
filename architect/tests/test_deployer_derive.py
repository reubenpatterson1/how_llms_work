from architect.deployer import derive_healthcheck_path, derive_port


def test_derive_health_path_from_express_handler(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "health-handler.js").write_text(
        "import express from 'express';\nconst r = express.Router();\nr.get('/healthz', (req, res) => res.json({status:'ok'}));\nexport default r;\n"
    )
    assert derive_healthcheck_path(str(tmp_path)) == "/healthz"


def test_derive_health_path_prefers_health_endpoints(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "weather-handler.js").write_text(
        "router.get('/api/weather', handler);\n"
    )
    (src / "health-handler.js").write_text(
        "router.get('/healthz', ok);\n"
    )
    # Should pick /healthz, not /api/weather
    assert derive_healthcheck_path(str(tmp_path)) == "/healthz"


def test_derive_health_path_falls_back_to_root(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "weather.js").write_text("router.get('/api/weather', h);\n")
    (src / "app.js").write_text("app.get('/', (req,res) => res.send('hi'));\n")
    # No health endpoint, but root exists
    assert derive_healthcheck_path(str(tmp_path)) == "/"


def test_derive_health_path_returns_none_when_no_routes(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "lib.js").write_text("export const x = 1;\n")
    assert derive_healthcheck_path(str(tmp_path)) is None


def test_derive_port_from_listen_call(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "app-server.js").write_text("app.listen(8080);\n")
    assert derive_port(str(tmp_path)) == 8080


def test_derive_port_returns_none_when_no_listen(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "lib.js").write_text("export const x = 1;\n")
    assert derive_port(str(tmp_path)) is None
