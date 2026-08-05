"""Regression: every build pushes to ONE shared ECR repo, but keeps per-run tags
and per-spec K8s resource names.

Guards the invariant introduced when the ECR repository name was decoupled from
BuildPackage.spec_slug: two different app ideas must resolve to the same
repository path with different tags, while their K8s Application name and
ingress host must still differ and still contain their own spec_slug.
"""

import os
import shutil

import pytest

from architect import webapp as _webapp
from architect.build_deploy_config import BuildDeployConfig

REGISTRY = "650127479436.dkr.ecr.us-east-1.amazonaws.com"
SHARED_REPO = f"{REGISTRY}/architect-builds/app"

_PKG_TEMPLATE = """metadata:
  name: {name}
  total_components: 0
  total_waves: 0
  max_parallelism: 1
spec:
  tech_stack:
    - "Language: JavaScript (ES2022)"
dag: {{}}
"""


@pytest.fixture
def fake_architect_root(tmp_path, monkeypatch):
    """Redirect webapp's on-disk lookups (workspaces/, templates/) into tmp_path.

    webapp derives both from os.path.dirname(__file__); the patch below only
    intercepts that exact argument and delegates every other call to the real
    os.path.dirname, so nothing else in the process changes behaviour.
    """
    real_arch = os.path.dirname(_webapp.__file__)
    root = tmp_path / "architect"
    (root / "workspaces").mkdir(parents=True)
    (root / "templates").mkdir()
    shutil.copyfile(
        os.path.join(real_arch, "templates", "deploy_template.yaml"),
        str(root / "templates" / "deploy_template.yaml"),
    )
    real_dirname = os.path.dirname
    monkeypatch.setattr(
        "architect.webapp.os.path.dirname",
        lambda p: str(root) if p == _webapp.__file__ else real_dirname(p),
    )
    # Pin config so the test doesn't depend on a host-local .build_deploy_config.json
    monkeypatch.setattr("architect.webapp._bdcfg.load", lambda *a, **kw: BuildDeployConfig())
    return root


def _make_workspace(root, run_id: str, spec_name: str):
    ws = root / "workspaces" / run_id
    (ws / "src").mkdir(parents=True)
    (ws / "src" / "app-server.js").write_text(
        "app.get('/healthz', h);\napp.listen(3000);\n"
    )
    (ws / "_package.yaml").write_text(_PKG_TEMPLATE.format(name=spec_name))
    return ws


def test_resolve_deploy_fields_shares_one_ecr_repo_across_specs(fake_architect_root):
    _make_workspace(fake_architect_root, "aaa111000000", "greeting-app")
    _make_workspace(fake_architect_root, "bbb222000000", "weather-dashboard")

    a, err_a = _webapp._resolve_deploy_fields("aaa111000000")
    b, err_b = _webapp._resolve_deploy_fields("bbb222000000")
    assert err_a is None and err_b is None

    # 1. Same repository path for both specs — no per-slug repo needed.
    assert a["image"] == f"{SHARED_REPO}:aaa111"
    assert b["image"] == f"{SHARED_REPO}:bbb222"
    assert a["image"].rsplit(":", 1)[0] == b["image"].rsplit(":", 1)[0] == SHARED_REPO

    # 2. Tags stay per-run-unique.
    assert a["image"] != b["image"]

    # 3. spec_slug must NOT leak into the repo path.
    assert "greeting-app" not in a["image"]
    assert "weather-dashboard" not in b["image"]

    # 4. K8s Application name + ingress host stay spec_slug-based and distinct.
    assert a["name"] == "greeting-app-aaa111"
    assert b["name"] == "weather-dashboard-bbb222"
    assert a["host"] == "greeting-app-aaa111-training.tools.fubotv.net"
    assert b["host"] == "weather-dashboard-bbb222-training.tools.fubotv.net"
    assert a["name"] != b["name"] and a["host"] != b["host"]


def test_get_deploy_page_uses_shared_ecr_repo(fake_architect_root):
    """Second call site: GET /deploy computes `image` independently of
    _resolve_deploy_fields, so it needs its own guard."""
    _make_workspace(fake_architect_root, "ccc333000000", "greeting-app")
    _webapp.app.config["TESTING"] = True
    with _webapp.app.test_client() as c:
        r = c.get("/deploy?run=ccc333000000")
    assert r.status_code == 200
    body = r.get_data(as_text=True)

    assert f'window.IMAGE_TAG = "{SHARED_REPO}:ccc333";' in body
    assert f"{REGISTRY}/architect-builds/greeting-app" not in body
    # Application name + host in the rendered manifest stay spec_slug-based.
    assert "name: greeting-app-ccc333" in body
    assert "host: greeting-app-ccc333-training.tools.fubotv.net" in body
