"""Comparative analysis engine: vague vs dense prompt quality metrics.

Runs N iterations of vague and dense generation, collects:
- Hallucination surface (% confabulated tokens)
- Output consistency (Jaccard similarity across runs)
- Dimension resolution (% grounded decisions)
- Code quality (structural completeness)
"""

import json
from dataclasses import dataclass

from .mock_llm import MockLLM, LLMOutput


@dataclass
class QualityMetrics:
    hallucination_surface: float
    consistency: float
    dimension_resolution: float
    code_quality: float

    def to_dict(self) -> dict:
        return {
            "hallucination_surface": round(self.hallucination_surface, 4),
            "consistency": round(self.consistency, 4),
            "dimension_resolution": round(self.dimension_resolution, 4),
            "code_quality": round(self.code_quality, 4),
        }


def _jaccard_similarity(sets: list[set[str]]) -> float:
    """Average pairwise Jaccard similarity."""
    if len(sets) < 2:
        return 1.0
    total = 0.0
    count = 0
    for i in range(len(sets)):
        for j in range(i + 1, len(sets)):
            intersection = len(sets[i] & sets[j])
            union = len(sets[i] | sets[j])
            total += intersection / union if union > 0 else 1.0
            count += 1
    return total / count if count > 0 else 1.0


def _extract_decisions(output: LLMOutput) -> set[str]:
    """Extract architectural decisions from output tokens for consistency measurement."""
    decisions = set()
    text = output.raw_text.lower()

    # Framework detection
    for fw in ["express", "fastapi", "hono", "django", "flask", "spring"]:
        if fw in text:
            decisions.add(f"framework:{fw}")

    # Database detection
    for db in ["mongoose", "mongodb", "postgresql", "pg", "sqlite", "drizzle", "sqlalchemy", "sqlmodel"]:
        if db in text:
            decisions.add(f"database:{db}")

    # Auth detection
    for auth in ["jwt", "jsonwebtoken", "oauth", "bearer", "session"]:
        if auth in text:
            decisions.add(f"auth:{auth}")

    # Pattern detection
    for pattern in ["middleware", "schema", "model", "route", "controller", "websocket"]:
        if pattern in text:
            decisions.add(f"pattern:{pattern}")

    # Port detection
    import re
    ports = re.findall(r'(?:listen|port)\D*(\d{4})', text)
    for port in ports:
        decisions.add(f"port:{port}")

    return decisions


def _code_quality_score(output: LLMOutput) -> float:
    """Score structural completeness of generated code."""
    text = output.raw_text.lower()
    checks = [
        ("has_endpoints", any(x in text for x in ["app.get", "app.post", "@app.get", "@app.post"])),
        ("has_model", any(x in text for x in ["schema", "model", "class", "table"])),
        ("has_imports", any(x in text for x in ["import", "require", "from"])),
        ("has_error_handling", any(x in text for x in ["try", "except", "catch", "httpexception", "status"])),
        ("has_auth", any(x in text for x in ["jwt", "auth", "bearer", "token", "security"])),
        ("has_validation", any(x in text for x in ["nullable", "required", "not null", "notnull", "validate"])),
        ("has_db_connection", any(x in text for x in ["engine", "pool", "connect", "mongoose.connect"])),
        ("has_realtime", any(x in text for x in ["websocket", "ws", "sse", "socket"])),
    ]
    return sum(1 for _, passed in checks if passed) / len(checks)


class Comparator:
    """Runs comparative analysis between vague and dense prompts."""

    def __init__(self, llm: MockLLM | None = None, iterations: int = 5):
        self.llm = llm or MockLLM()
        self.iterations = iterations
        self.vague_outputs: list[LLMOutput] = []
        self.dense_outputs: list[LLMOutput] = []

    def run(self, vague_prompt: str = "Build me a task management API with real-time updates",
            dense_spec: str = "# Dense Architecture Specification...") -> dict:
        """Run comparative analysis."""
        self.vague_outputs = []
        self.dense_outputs = []

        for i in range(self.iterations):
            vague_out = self.llm.generate(vague_prompt, run_index=i)
            self.vague_outputs.append(vague_out)

            dense_out = self.llm.generate(vague_prompt, spec=dense_spec, run_index=i)
            self.dense_outputs.append(dense_out)

        return self._compute_results()

    def _compute_results(self) -> dict:
        vague_metrics = self._compute_metrics(self.vague_outputs)
        dense_metrics = self._compute_metrics(self.dense_outputs)

        return {
            "iterations": self.iterations,
            "vague": {
                "metrics": vague_metrics.to_dict(),
                "outputs": [o.to_dict() for o in self.vague_outputs],
            },
            "dense": {
                "metrics": dense_metrics.to_dict(),
                "outputs": [o.to_dict() for o in self.dense_outputs],
            },
            "deltas": {
                "hallucination_reduction": round(
                    vague_metrics.hallucination_surface - dense_metrics.hallucination_surface, 4),
                "consistency_improvement": round(
                    dense_metrics.consistency - vague_metrics.consistency, 4),
                "resolution_improvement": round(
                    dense_metrics.dimension_resolution - vague_metrics.dimension_resolution, 4),
                "quality_improvement": round(
                    dense_metrics.code_quality - vague_metrics.code_quality, 4),
            },
        }

    def _compute_metrics(self, outputs: list[LLMOutput]) -> QualityMetrics:
        if not outputs:
            return QualityMetrics(0, 0, 0, 0)

        # Average hallucination surface
        avg_hallucination = sum(o.hallucination_surface for o in outputs) / len(outputs)

        # Consistency: Jaccard similarity of architectural decisions across runs
        decision_sets = [_extract_decisions(o) for o in outputs]
        consistency = _jaccard_similarity(decision_sets)

        # Dimension resolution: % of grounded tokens (grounded / total)
        total_tokens = sum(len(o.tokens) for o in outputs)
        grounded_tokens = sum(
            sum(1 for t in o.tokens if t.grounding == "grounded")
            for o in outputs
        )
        dimension_resolution = grounded_tokens / total_tokens if total_tokens > 0 else 0.0

        # Code quality
        avg_quality = sum(_code_quality_score(o) for o in outputs) / len(outputs)

        return QualityMetrics(
            hallucination_surface=avg_hallucination,
            consistency=consistency,
            dimension_resolution=dimension_resolution,
            code_quality=avg_quality,
        )

    def export_json(self, path: str):
        results = self._compute_results()
        with open(path, "w") as f:
            json.dump(results, f, indent=2)
