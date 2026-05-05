import json
import os
import tempfile
from architect.build_deploy_config import BuildDeployConfig, load, save, DEFAULTS


def test_defaults_are_sensible():
    assert DEFAULTS["ollama_model"] == "mistral:7b"
    assert DEFAULTS["ollama_base_url"] == "http://localhost:11434"
    assert DEFAULTS["default_namespace"] == "training"
    assert DEFAULTS["aws_region"] == "us-east-1"


def test_load_returns_defaults_when_no_file(tmp_path):
    cfg_path = tmp_path / "missing.json"
    cfg = load(str(cfg_path))
    assert cfg.ollama_model == "mistral:7b"
    assert cfg.default_namespace == "training"


def test_save_then_load_roundtrip(tmp_path):
    cfg_path = tmp_path / "cfg.json"
    cfg = BuildDeployConfig(
        ollama_model="qwen2.5-coder:32b",
        ollama_base_url="http://other:11434",
        ecr_registry="650127479436.dkr.ecr.us-east-1.amazonaws.com",
        ecr_repository_prefix="architect-builds",
        default_namespace="training",
        aws_region="us-east-1",
    )
    save(cfg, str(cfg_path))
    loaded = load(str(cfg_path))
    assert loaded.ollama_model == "qwen2.5-coder:32b"
    assert loaded.ecr_registry == "650127479436.dkr.ecr.us-east-1.amazonaws.com"


def test_load_missing_keys_fall_back_to_defaults(tmp_path):
    cfg_path = tmp_path / "partial.json"
    cfg_path.write_text(json.dumps({"ollama_model": "custom:7b"}))
    cfg = load(str(cfg_path))
    assert cfg.ollama_model == "custom:7b"
    assert cfg.default_namespace == "training"  # default
