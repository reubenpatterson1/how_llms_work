"""Deploy stage: YAML render, image build/push, kubectl apply, ingress poll."""

import os


def render_yaml(
    template_path: str,
    name: str,
    namespace: str,
    image: str,
    port: int,
    host: str,
    healthcheck_path: str,
) -> str:
    if not healthcheck_path:
        raise ValueError(
            "healthcheck_path is required — must be derived from the generated app, "
            "not defaulted (see spec §6 step 1)"
        )
    with open(template_path, "r") as f:
        template = f.read()
    return (
        template
        .replace("{{name}}", name)
        .replace("{{namespace}}", namespace)
        .replace("{{image}}", image)
        .replace("{{port}}", str(port))
        .replace("{{host}}", host)
        .replace("{{healthcheck_path}}", healthcheck_path)
    )
