"""Deploy stage: YAML render, image build/push, kubectl apply, ingress poll."""

import os
import re
import subprocess
import time

import requests


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


class DeployError(Exception):
    """Generic deploy step failure."""


class EcrAuthError(DeployError):
    """ECR docker login is missing or expired."""


_ECR_AUTH_MARKERS = ("no basic auth credentials", "denied: User", "401 Unauthorized")


def docker_build(image_tag: str, workspace: str) -> str:
    cp = subprocess.run(
        ["docker", "build", "-t", image_tag, workspace],
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        raise DeployError(f"docker build failed: {cp.stderr.strip() or cp.stdout.strip()}")
    return cp.stdout


def docker_push(image_tag: str, region: str, registry: str) -> str:
    cp = subprocess.run(
        ["docker", "push", image_tag],
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        stderr = cp.stderr or ""
        if any(marker in stderr for marker in _ECR_AUTH_MARKERS):
            raise EcrAuthError(
                f"ECR auth missing or expired. Run: "
                f"aws ecr get-login-password --region {region} | "
                f"docker login --username AWS --password-stdin {registry}\n\n"
                f"Original error: {stderr.strip()}"
            )
        raise DeployError(f"docker push failed: {stderr.strip()}")
    return cp.stdout


def kubectl_apply(yaml_path: str) -> str:
    cp = subprocess.run(
        ["kubectl", "apply", "-f", yaml_path],
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        raise DeployError(f"kubectl apply failed: {cp.stderr.strip() or cp.stdout.strip()}")
    return cp.stdout


class IngressTimeout(DeployError):
    """Ingress did not become ready within the deadline."""


def poll_ingress(url: str, timeout_s: int = 120, interval_s: int = 5) -> float:
    started = time.time()
    while True:
        try:
            r = requests.get(url, timeout=5, allow_redirects=False)
            if r.status_code in (200, 302):
                return time.time() - started
        except requests.RequestException:
            pass
        if time.time() - started >= timeout_s:
            raise IngressTimeout(f"{url} did not become ready within {timeout_s}s")
        time.sleep(interval_s)
