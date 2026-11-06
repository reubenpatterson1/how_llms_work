"""Regression: Build run b6cb0a5da5c8 (2026-10-26) wrote 3 of 6 Python modules ending in a
literal "<unused56>" token, so the app shim skipped them with SyntaxError.

"<unused56>" is gemma4:e4b vocab id 69, a normal-type (not control) token, so Ollama 0.32.5
detokenizes it as text. Every build call ended with stop and truncated = 0, so this is not
truncation. Fixtures are byte-for-byte copies of the files the run wrote.
"""
from pathlib import Path

import pytest

from architect.builder import PostProcessError, post_process_output

FIX = Path(__file__).parent / "fixtures" / "build_run1"


@pytest.mark.parametrize("name", ["weather-middleware", "weather-service", "openweather-api-client"])
def test_post_process_strips_gemma_unused_token_from_run1_outputs(name):
    raw = (FIX / f"{name}.py.txt").read_text(encoding="utf-8")
    assert "<unused56>" in raw
    with pytest.raises(SyntaxError):
        compile(raw, name, "exec")
    cleaned = post_process_output(raw)
    assert "<unused" not in cleaned
    compile(cleaned, name, "exec")
    assert cleaned.endswith("\n")


def test_post_process_strips_unused_token_inside_and_after_fence():
    raw = "```python\nx = 1<unused12>\n```<unused56>"
    assert post_process_output(raw) == "x = 1\n"


def test_post_process_unused_token_only_counts_as_empty_output():
    with pytest.raises(PostProcessError, match="empty output"):
        post_process_output("<unused56>\n")
