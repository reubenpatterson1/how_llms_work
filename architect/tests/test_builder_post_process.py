import pytest
from architect.builder import post_process_output, PostProcessError


def test_clean_code_passes_through():
    raw = "import express from 'express';\n\nconst app = express();\n"
    assert post_process_output(raw).strip() == raw.strip()


def test_strips_simple_fence():
    raw = "```javascript\nimport express from 'express';\n```"
    assert post_process_output(raw).strip() == "import express from 'express';"


def test_strips_fence_with_no_lang():
    raw = "```\nfoo\nbar\n```"
    assert post_process_output(raw).strip() == "foo\nbar"


def test_strips_prose_preamble_before_fence():
    raw = "Here's the code:\n\n```javascript\nimport x from 'x';\n```"
    assert post_process_output(raw).strip() == "import x from 'x';"


def test_strips_leading_whitespace_and_fence():
    raw = "  \n\n ```javascript\nfoo\n```\n\n"
    assert post_process_output(raw).strip() == "foo"


def test_prose_only_no_fence_raises():
    raw = "I cannot write that code. Sorry."
    with pytest.raises(PostProcessError):
        post_process_output(raw)


def test_empty_string_raises():
    with pytest.raises(PostProcessError):
        post_process_output("")
    with pytest.raises(PostProcessError):
        post_process_output("   \n\n")
