"""Configuration for the Stage 3 build/deploy agent.

Kept separate from ProviderConfig (in llm_judge.py) to limit blast radius —
the existing intake/decompose stages don't need to know about ECR or kubectl.
"""

import json
import os
from dataclasses import dataclass, asdict

DEFAULTS = {
    "ollama_model": "gemma4:e4b",
    "ollama_base_url": "http://localhost:11434",
    "ecr_registry": "650127479436.dkr.ecr.us-east-1.amazonaws.com",
    "ecr_repository_prefix": "architect-builds",
    # Single shared ECR repository for every build, decoupled from the app's spec_slug.
    # Invariant: one repo, per-run-unique tags (<run_id[:6]>) — so images from different
    # runs and different app ideas coexist without collision. The deployed K8s Application
    # name and ingress host stay derived from spec_slug, so per-user isolation is unaffected.
    "ecr_shared_repo_slug": "app",
    "default_namespace": "training",
    "aws_region": "us-east-1",
}


@dataclass
class BuildDeployConfig:
    ollama_model: str = DEFAULTS["ollama_model"]
    ollama_base_url: str = DEFAULTS["ollama_base_url"]
    ecr_registry: str = DEFAULTS["ecr_registry"]
    ecr_repository_prefix: str = DEFAULTS["ecr_repository_prefix"]
    ecr_shared_repo_slug: str = DEFAULTS["ecr_shared_repo_slug"]
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
