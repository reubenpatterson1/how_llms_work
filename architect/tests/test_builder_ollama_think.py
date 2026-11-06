"""The Builder's Ollama call must disable gemma4 hidden reasoning (as Decompose does since 1580c6c)
and log Ollama's own completion stats, because the app journal had no Builder lines at all in run
b6cb0a5da5c8. In that run, 5 of 6 build calls spent about 250-460 eval tokens on hidden reasoning
inside the box's 4096-token context."""
from unittest.mock import MagicMock, patch

from architect.builder import OllamaClient


def _post_with(body):
    resp = MagicMock()
    resp.json.return_value = body
    resp.raise_for_status = MagicMock()
    return patch("architect.builder.requests.post", return_value=resp)


def test_builder_generate_sends_think_false():
    client = OllamaClient(base_url="http://ollama.invalid:11434", model="gemma4:e4b")
    with _post_with({"response": "import os\n"}) as post:
        assert client.generate("p") == "import os\n"
    payload = post.call_args.kwargs["json"]
    assert payload["think"] is False
    assert payload["options"] == {"temperature": 0.1}
    assert payload["stream"] is False


def test_builder_generate_logs_done_reason_and_eval_counts(capsys):
    client = OllamaClient(base_url="http://ollama.invalid:11434", model="gemma4:e4b")
    body = {"response": "x = 1\n", "done_reason": "stop", "eval_count": 861, "prompt_eval_count": 1510}
    with _post_with(body):
        client.generate("p")
    err = capsys.readouterr().err
    assert "[Builder] Ollama gemma4:e4b: done_reason=stop eval_count=861 prompt_eval_count=1510" in err
