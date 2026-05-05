import os
from architect.deployer import render_yaml


def test_render_substitutes_all_fields(tmp_path):
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "templates", "deploy_template.yaml"
    )
    rendered = render_yaml(
        template_path=template_path,
        name="hello-world",
        namespace="training",
        image="650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/hello-world:abc123",
        port=3000,
        host="hello-world-training.tools.fubotv.net",
        healthcheck_path="/healthz",
    )
    assert "name: hello-world" in rendered
    assert "namespace: training" in rendered
    assert "image: 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/hello-world:abc123" in rendered
    assert "containerPort: 3000" in rendered
    assert "host: hello-world-training.tools.fubotv.net" in rendered
    assert "path: /healthz" in rendered
    assert "{{" not in rendered  # no unsubstituted placeholders


def test_render_raises_on_missing_field(tmp_path):
    import pytest
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "templates", "deploy_template.yaml"
    )
    with pytest.raises(ValueError):
        render_yaml(
            template_path=template_path,
            name="hello-world",
            namespace="training",
            image="img:tag",
            port=3000,
            host="h.example.com",
            healthcheck_path=None,  # invalid
        )
