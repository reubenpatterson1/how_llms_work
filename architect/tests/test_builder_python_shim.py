import importlib.util
import json
import os
import sys
import textwrap
import uuid

import pytest
from unittest.mock import MagicMock

from architect.builder import assemble_project, run_build
from architect.deployer import derive_healthcheck_path


@pytest.fixture(autouse=True)
def _isolate_imports():
    saved_path = list(sys.path)
    saved_modules = set(sys.modules)
    saved_bytecode_flag = sys.dont_write_bytecode
    yield
    for name in list(sys.modules):
        if name not in saved_modules and (
            name.startswith("_arch_component_") or name.startswith("_shim_")
        ):
            del sys.modules[name]
    sys.path[:] = saved_path
    sys.dont_write_bytecode = saved_bytecode_flag


def _load_shim(workspace):
    """Execute the generated src/app.py in-process and return its module."""
    path = os.path.join(str(workspace), "src", "app.py")
    mod_name = "_shim_" + uuid.uuid4().hex
    spec = importlib.util.spec_from_file_location(mod_name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    spec.loader.exec_module(module)
    return module


GREETING_BP = textwrap.dedent("""
    from flask import Blueprint, jsonify, request

    bp = Blueprint('thing', __name__)


    @bp.get('/greet')
    def greet():
        return jsonify({'greeting': 'hello ' + request.args.get('name', 'world')}), 200
""")

OTHER_BP = textwrap.dedent("""
    from flask import Blueprint, jsonify, request

    bp = Blueprint('thing', __name__)


    @bp.get('/other')
    def other():
        return jsonify({'ok': True}), 200
""")

ROOT_BP = textwrap.dedent("""
    from flask import Blueprint

    bp = Blueprint('rootbp', __name__)


    @bp.get('/')
    def root():
        return 'from-blueprint'
""")

BROKEN_SRC = "from flask import Blueprint\ndef broken(:\n"

MISSING_DEP_SRC = "import totally_missing_module_xyz\ndef f():\n    return 1\n"

# Mirrors the shape taught by architect/builder_templates/model_python.txt: a plain
# dataclass, no Blueprint.
MODEL_SRC = textwrap.dedent("""
    from dataclasses import dataclass

    @dataclass
    class Thing:
        id: str
        name: str
""")

BLOCKING_SRC = textwrap.dedent("""
    import os

    from flask import Blueprint

    bp = Blueprint('blocking', __name__)


    @bp.get('/blocking')
    def blocking():
        return 'blocked', 200


    class _Server:
        def run(self, host=None):
            sentinel = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'SENTINEL.txt')
            with open(sentinel, 'w') as f:
                f.write('ran')


    app = _Server()
    app.run(host='0.0.0.0')
""")


def test_python_assembly_writes_app_py_shim_when_missing(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    shim_path = src / "app.py"
    assert shim_path.exists()
    content = shim_path.read_text()
    assert "/healthz" in content
    assert 'host="0.0.0.0"' in content
    assert "Blueprint" in content
    assert "else 3000" in content
    assert "__PORT__" not in content


def test_python_shim_port_is_templated(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    assemble_project(str(workspace), language="python", port=8123, packages=["flask", "requests"])

    content = (src / "app.py").read_text()
    assert "else 8123" in content
    assert "3000" not in content


def test_python_assembly_preserves_existing_app_py(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    custom = (
        "from flask import Flask\n"
        "app = Flask(__name__)\n"
        'if __name__ == "__main__":\n'
        '    app.run(host="0.0.0.0", port=3000)\n'
    )
    (src / "app.py").write_text(custom)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    assert (src / "app.py").read_text() == custom


def test_shim_mounts_blueprint_and_serves_healthz(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    mod = _load_shim(workspace)
    client = mod.app.test_client()

    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}

    resp = client.get("/greet")
    assert resp.status_code == 200
    assert resp.get_json() == {"greeting": "hello world"}


def test_shim_survives_broken_siblings(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    (src / "broken-handler.py").write_text(BROKEN_SRC)
    (src / "missing-dep-service.py").write_text(MISSING_DEP_SRC)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    mod = _load_shim(workspace)
    client = mod.app.test_client()

    resp = client.get("/greet")
    assert resp.status_code == 200
    resp = client.get("/healthz")
    assert resp.status_code == 200


def test_shim_skips_module_level_run(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    (src / "blocking-handler.py").write_text(BLOCKING_SRC)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    mod = _load_shim(workspace)
    client = mod.app.test_client()

    resp = client.get("/greet")
    assert resp.status_code == 200
    resp = client.get("/blocking")
    assert resp.status_code == 404
    assert os.path.exists(src / "SENTINEL.txt") is False


def test_shim_root_fallback_when_no_blueprint_claims_root(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    mod = _load_shim(workspace)
    client = mod.app.test_client()

    resp = client.get("/")
    assert resp.status_code == 200
    assert "Hello, World!" in resp.get_data(as_text=True)


def test_shim_defers_root_to_blueprint(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "root-handler.py").write_text(ROOT_BP)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    mod = _load_shim(workspace)
    client = mod.app.test_client()

    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.get_data(as_text=True) == "from-blueprint"

    root_rules = [r for r in mod.app.url_map.iter_rules() if r.rule == "/"]
    assert len(root_rules) == 1


def test_shim_registers_colliding_blueprint_names(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "greeting-handler.py").write_text(GREETING_BP)
    (src / "other-handler.py").write_text(OTHER_BP)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    mod = _load_shim(workspace)
    client = mod.app.test_client()

    resp = client.get("/greet")
    assert resp.status_code == 200
    resp = client.get("/other")
    assert resp.status_code == 200


def test_shim_ignores_non_blueprint_modules(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "thing-model.py").write_text(MODEL_SRC)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    mod = _load_shim(workspace)
    client = mod.app.test_client()

    resp = client.get("/healthz")
    assert resp.status_code == 200

    rules = {r.rule for r in mod.app.url_map.iter_rules()}
    assert rules == {"/", "/healthz", "/static/<path:filename>"}


def test_derive_healthcheck_path_prefers_shim_healthz(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    # GREETING_BP contains request.args.get('name', 'world'), which the deployer's
    # generic `.get('literal')` scraper also matches as a route candidate. Before
    # this fix, that false positive ('name') could win out over the real
    # healthcheck; the priority list plus /healthz always being present now wins.
    (src / "greeting-handler.py").write_text(GREETING_BP)
    assemble_project(str(workspace), language="python", port=3000, packages=["flask", "requests"])

    assert derive_healthcheck_path(str(workspace)) == "/healthz"


def test_derive_healthcheck_path_ignores_binary_files(tmp_path):
    workspace = tmp_path / "ws"
    src = workspace / "src"
    src.mkdir(parents=True)
    (src / "app.py").write_text('app.get("/healthz")\n')
    (src / "blob.pyc").write_bytes(b"\xf3\r\n\x00")

    assert derive_healthcheck_path(str(workspace)) == "/healthz"


def test_run_build_python_writes_shim_and_dockerfile(tmp_path):
    pkg_yaml = textwrap.dedent("""
    metadata:
      name: greeting-app
      max_parallelism: 2
    spec:
      tech_stack:
        - "Language: Python 3.12"
        - "Framework: Flask 3"
    dag:
      greeting-handler:
        type: handler
        wave: 0
        constraints: []
        prompt: "p1"
      other-handler:
        type: handler
        wave: 0
        constraints: []
        prompt: "p2"
    """)
    pkg_path = tmp_path / "pkg.yaml"
    pkg_path.write_text(pkg_yaml)
    workspace = tmp_path / "ws"
    workspace.mkdir()

    ollama = MagicMock()
    ollama.generate.return_value = "```python\n" + GREETING_BP + "```"

    run_build(
        package_path=str(pkg_path),
        workspace=str(workspace),
        ollama=ollama,
        emit=lambda e, p: None,
        runtime="Python 3.12",
    )

    src = workspace / "src"
    assert (src / "greeting-handler.py").exists()
    assert (src / "other-handler.py").exists()
    assert (src / "app.py").exists()
    assert (workspace / "Dockerfile").exists()
    assert (workspace / "requirements.txt").exists()

    dockerfile = (workspace / "Dockerfile").read_text()
    assert "EXPOSE 3000" in dockerfile

    shim = (src / "app.py").read_text()
    assert "else 3000" in shim

    reqs = (workspace / "requirements.txt").read_text()
    assert "flask" in reqs
