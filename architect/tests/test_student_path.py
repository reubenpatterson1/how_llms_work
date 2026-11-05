import os
import yaml
from architect.deployer import render_yaml

HERE = os.path.dirname(__file__)
TEMPLATES = os.path.join(HERE, "..", "templates")
STATIC = os.path.join(HERE, "..", "static")


def test_stock_template_has_openweather_secret_env():
    rendered = render_yaml(
        os.path.join(TEMPLATES, "deploy_template.yaml"),
        name="sample-app",
        namespace="training",
        image="example/img:1",
        port=3000,
        host="sample-app-training.tools.fubotv.net",
        healthcheck_path="/healthz",
    )
    assert "secretKeyRef" in rendered
    assert "name: sample-app-openweather" in rendered
    assert "key: OPENWEATHER_API_KEY" in rendered
    assert "optional: true" in rendered
    doc = yaml.safe_load(rendered)
    ref = doc["spec"]["env"][0]["valueFrom"]["secretKeyRef"]
    assert ref["name"] == "sample-app-openweather"
    assert ref["optional"] is True


def test_decompose_continue_link_goes_to_build():
    text = open(os.path.join(TEMPLATES, "decompose.html")).read()
    assert "{{ pfx }}/build\"" in text
    assert "hello-world-build-package" not in text


def test_deploy_js_handoff_panel_text():
    text = open(os.path.join(STATIC, "deploy.js")).read()
    for needle in ["--context vat-dev", "AWS_PROFILE=fubo-tools",
                   "create secret generic", "-openweather", "HTTPS only"]:
        assert needle in text


def _read(rel):
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(base, rel)) as f:
        return f.read()


def test_build_js_guards_continue_link_on_failures():
    js = _read("static/build.js")
    assert "failedComponentIds" in js
    assert "Reload this page and upload your build package again" in js
    seg = js[js.index('case "build:complete"'):js.index('case "build:fatal"')]
    assert "addDeployLink()" in seg
    fn = js[js.index("function addDeployLink"):js.index("socket.on", js.index("function addDeployLink"))]
    assert "failedComponentIds" in fn
    assert "failedComponentIds" in js


def test_templates_cache_bust_scripts():
    assert "?v=20261105c" in _read("templates/build.html")
    assert "?v=20261105b" in _read("templates/deploy.html")


def test_build_js_single_deploy_link():
    js = _read("static/build.js")
    assert "function addDeployLink" in js
    assert 'id = "deploy-link"' in js
    assert js.count("Continue to Deploy") == 1
