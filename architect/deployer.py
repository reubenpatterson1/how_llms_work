"""Deploy stage: YAML render, image build/push, kubectl apply, ingress poll."""

import os
import re


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


_GET_ROUTE_RE = re.compile(r"""\.get\(\s*['"]([^'"]+)['"]""")
_LISTEN_RE = re.compile(r"""\.listen\(\s*(\d+)""")
_HEALTH_PRIORITY = ["/healthz", "/health", "/readyz", "/ready", "/ping", "/"]


def _scan_files(workspace: str) -> list[str]:
    src = os.path.join(workspace, "src")
    if not os.path.isdir(src):
        return []
    files = []
    for root, _, names in os.walk(src):
        for n in names:
            files.append(os.path.join(root, n))
    return files


def derive_healthcheck_path(workspace: str) -> str | None:
    found_routes: set[str] = set()
    for fp in _scan_files(workspace):
        try:
            text = open(fp, "r").read()
        except OSError:
            continue
        for m in _GET_ROUTE_RE.finditer(text):
            found_routes.add(m.group(1))
    if not found_routes:
        return None
    for candidate in _HEALTH_PRIORITY:
        if candidate in found_routes:
            return candidate
    # No priority match — return any route, prefer shortest
    return sorted(found_routes, key=len)[0]


def derive_port(workspace: str) -> int | None:
    for fp in _scan_files(workspace):
        try:
            text = open(fp, "r").read()
        except OSError:
            continue
        m = _LISTEN_RE.search(text)
        if m:
            return int(m.group(1))
    return None
