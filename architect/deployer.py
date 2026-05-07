"""Deploy stage: YAML render, image build/push, kubectl apply, ingress poll."""

import os
import re
import subprocess
import time

import requests


def render_yaml_text(
    template: str,
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
    return (
        template
        .replace("{{name}}", name)
        .replace("{{namespace}}", namespace)
        .replace("{{image}}", image)
        .replace("{{port}}", str(port))
        .replace("{{host}}", host)
        .replace("{{healthcheck_path}}", healthcheck_path)
    )


def render_yaml(
    template_path: str,
    name: str,
    namespace: str,
    image: str,
    port: int,
    host: str,
    healthcheck_path: str,
) -> str:
    with open(template_path, "r") as f:
        template = f.read()
    return render_yaml_text(
        template=template,
        name=name,
        namespace=namespace,
        image=image,
        port=port,
        host=host,
        healthcheck_path=healthcheck_path,
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


def docker_build(image_tag: str, workspace: str, platform: str = "linux/amd64") -> str:
    # Pin platform so Mac (arm64) hosts produce amd64 images for the fubo cluster.
    # Caught in Phase 4 smoke test 2026-05-05: pod entered ImagePullBackOff with
    # "no match for platform in manifest" because docker on Apple Silicon defaulted to arm64.
    cp = subprocess.run(
        ["docker", "build", "--platform", platform, "-t", image_tag, workspace],
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        raise DeployError(f"docker build failed: {cp.stderr.strip() or cp.stdout.strip()}")
    return cp.stdout


def _extract_repo_name(image_tag: str, registry: str) -> str | None:
    """Extract the ECR repo path from a full image tag.
    e.g. '650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/foo:abc'
         → 'architect-builds/foo'
    """
    if not image_tag.startswith(registry + "/"):
        return None
    rest = image_tag[len(registry) + 1:]
    return rest.split(":", 1)[0]


def ensure_ecr_repository(image_tag: str, region: str, registry: str) -> str:
    """Create the ECR repository for image_tag if it doesn't exist.

    Returns the repo name. Raises DeployError if AWS CLI fails for non-NotFound reasons.
    """
    repo = _extract_repo_name(image_tag, registry)
    if not repo:
        return ""  # not an ECR image; skip
    describe = subprocess.run(
        ["aws", "ecr", "describe-repositories", "--region", region, "--repository-names", repo],
        capture_output=True, text=True,
    )
    if describe.returncode == 0:
        return repo  # already exists
    if "RepositoryNotFoundException" not in (describe.stderr or "") + (describe.stdout or ""):
        raise DeployError(
            f"aws ecr describe-repositories failed (non-NotFound): {describe.stderr.strip() or describe.stdout.strip()}"
        )
    create = subprocess.run(
        ["aws", "ecr", "create-repository", "--region", region, "--repository-name", repo],
        capture_output=True, text=True,
    )
    if create.returncode != 0:
        raise DeployError(
            f"aws ecr create-repository {repo} failed: {create.stderr.strip() or create.stdout.strip()}"
        )
    return repo


def docker_push(image_tag: str, region: str, registry: str) -> str:
    # Auto-create the ECR repo if it doesn't exist yet.
    # First deploy of any new spec lands here — failing on missing repo is unfriendly.
    try:
        ensure_ecr_repository(image_tag, region, registry)
    except DeployError:
        # If we can't create (e.g. IAM policy), let docker push surface the real error
        pass

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
