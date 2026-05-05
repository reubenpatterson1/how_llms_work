from unittest.mock import patch, MagicMock
from architect.builder import OllamaClient, OllamaError
import pytest


def test_generate_returns_response_text():
    client = OllamaClient(base_url="http://localhost:11434", model="mistral:7b")
    fake_response = MagicMock()
    fake_response.json.return_value = {"response": "import x from 'x';\n"}
    fake_response.raise_for_status = MagicMock()
    with patch("architect.builder.requests.post", return_value=fake_response) as mock_post:
        out = client.generate("wrapped prompt here")
    assert out == "import x from 'x';\n"
    mock_post.assert_called_once()
    sent = mock_post.call_args
    assert sent.kwargs["json"]["model"] == "mistral:7b"
    assert sent.kwargs["json"]["prompt"] == "wrapped prompt here"
    assert sent.kwargs["json"]["stream"] is False
    assert sent.kwargs["json"]["options"]["temperature"] == 0.1


def test_generate_raises_on_http_error():
    import requests
    client = OllamaClient(base_url="http://localhost:11434", model="mistral:7b")
    fake_response = MagicMock()
    fake_response.raise_for_status.side_effect = requests.HTTPError("500")
    with patch("architect.builder.requests.post", return_value=fake_response):
        with pytest.raises(OllamaError):
            client.generate("p")


def test_generate_raises_on_connection_error():
    import requests
    client = OllamaClient(base_url="http://localhost:11434", model="mistral:7b")
    with patch("architect.builder.requests.post", side_effect=requests.ConnectionError("nope")):
        with pytest.raises(OllamaError):
            client.generate("p")
