from unittest.mock import patch, MagicMock
import pytest
from architect.deployer import poll_ingress, IngressTimeout


def _resp(status):
    r = MagicMock()
    r.status_code = status
    return r


def test_poll_returns_immediately_on_200():
    with patch("architect.deployer.requests.get", return_value=_resp(200)) as g:
        elapsed = poll_ingress("https://host.example/healthz", timeout_s=10, interval_s=1)
    assert elapsed >= 0
    assert g.call_count == 1


def test_poll_succeeds_after_initial_503():
    seq = [_resp(503), _resp(503), _resp(200)]
    with patch("architect.deployer.requests.get", side_effect=seq):
        with patch("architect.deployer.time.sleep"):
            elapsed = poll_ingress("https://host.example/healthz", timeout_s=10, interval_s=1)
    assert elapsed >= 0


def test_poll_raises_on_timeout():
    with patch("architect.deployer.requests.get", return_value=_resp(503)):
        with patch("architect.deployer.time.sleep"):
            with pytest.raises(IngressTimeout):
                poll_ingress("https://host.example/healthz", timeout_s=2, interval_s=1)


def test_poll_treats_302_as_success():
    with patch("architect.deployer.requests.get", return_value=_resp(302)):
        elapsed = poll_ingress("https://host.example/healthz", timeout_s=10, interval_s=1)
    assert elapsed >= 0
