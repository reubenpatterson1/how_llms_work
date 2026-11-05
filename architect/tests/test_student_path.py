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
