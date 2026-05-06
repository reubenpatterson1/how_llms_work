from unittest.mock import patch, MagicMock
import pytest
from architect.deployer import docker_build, docker_push, kubectl_apply, EcrAuthError, DeployError


def _completed(returncode=0, stdout="", stderr=""):
    cp = MagicMock()
    cp.returncode = returncode
    cp.stdout = stdout
    cp.stderr = stderr
    return cp


def test_docker_build_invokes_correct_command_with_amd64_platform(tmp_path):
    with patch("architect.deployer.subprocess.run", return_value=_completed(0, "ok", "")) as run:
        docker_build("img:tag", str(tmp_path))
    args = run.call_args.args[0]
    assert args[0:5] == ["docker", "build", "--platform", "linux/amd64", "-t"]
    assert args[5] == "img:tag"
    assert args[6] == str(tmp_path)


def test_docker_build_platform_override(tmp_path):
    with patch("architect.deployer.subprocess.run", return_value=_completed(0, "ok", "")) as run:
        docker_build("img:tag", str(tmp_path), platform="linux/arm64")
    args = run.call_args.args[0]
    assert "--platform" in args
    assert args[args.index("--platform") + 1] == "linux/arm64"


def test_docker_build_raises_on_failure(tmp_path):
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "build failed")):
        with pytest.raises(DeployError):
            docker_build("img:tag", str(tmp_path))


def test_docker_push_raises_ecr_auth_error_on_no_basic_auth():
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "no basic auth credentials")):
        with pytest.raises(EcrAuthError) as exc:
            docker_push("registry.example/img:tag", region="us-east-1", registry="registry.example")
        assert "aws ecr get-login-password" in str(exc.value)


def test_docker_push_raises_ecr_auth_error_on_denied():
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "denied: User: arn:... is not authorized")):
        with pytest.raises(EcrAuthError):
            docker_push("registry.example/img:tag", region="us-east-1", registry="registry.example")


def test_docker_push_raises_generic_deploy_error_on_other_failure():
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "manifest unknown")):
        with pytest.raises(DeployError):
            docker_push("registry.example/img:tag", region="us-east-1", registry="registry.example")


def test_kubectl_apply_invokes_correct_command(tmp_path):
    yaml_path = tmp_path / "deploy.yaml"
    yaml_path.write_text("apiVersion: v1\nkind: Pod\n")
    with patch("architect.deployer.subprocess.run", return_value=_completed(0, "applied", "")) as run:
        kubectl_apply(str(yaml_path))
    args = run.call_args.args[0]
    assert args == ["kubectl", "apply", "-f", str(yaml_path)]


def test_kubectl_apply_raises_on_failure(tmp_path):
    yaml_path = tmp_path / "deploy.yaml"
    yaml_path.write_text("bad")
    with patch("architect.deployer.subprocess.run", return_value=_completed(1, "", "the YAML is invalid")):
        with pytest.raises(DeployError):
            kubectl_apply(str(yaml_path))
