"""Configuration for the Stage 3 build/deploy agent.

Kept separate from ProviderConfig (in llm_judge.py) to limit blast radius —
the existing intake/decompose stages don't need to know about ECR or kubectl.
"""

import json
import os
from dataclasses import dataclass, asdict

DEFAULTS = {
    "ollama_model": "mistral:7b",
    "ollama_base_url": "http://localhost:11434",
    "ecr_registry": "650127479436.dkr.ecr.us-east-1.amazonaws.com",
    "ecr_repository_prefix": "architect-builds",
    "default_namespace": "training",
    "aws_region": "us-east-1",
}


@dataclass
class BuildDeployConfig:
    ollama_model: str = DEFAULTS["ollama_model"]
    ollama_base_url: str = DEFAULTS["ollama_base_url"]
    ecr_registry: str = DEFAULTS["ecr_registry"]
    ecr_repository_prefix: str = DEFAULTS["ecr_repository_prefix"]
    default_namespace: str = DEFAULTS["default_namespace"]
    aws_region: str = DEFAULTS["aws_region"]


_DEFAULT_PATH = os.path.join(os.path.dirname(__file__), ".build_deploy_config.json")


def load(path: str = _DEFAULT_PATH) -> BuildDeployConfig:
    if not os.path.exists(path):
        return BuildDeployConfig()
    with open(path, "r") as f:
        data = json.load(f)
    merged = {**DEFAULTS, **data}
    return BuildDeployConfig(**{k: merged[k] for k in DEFAULTS.keys()})


def save(cfg: BuildDeployConfig, path: str = _DEFAULT_PATH) -> None:
    with open(path, "w") as f:
        json.dump(asdict(cfg), f, indent=2)
