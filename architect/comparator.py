"""Comparative analysis engine: vague vs dense prompt quality metrics.

Runs N iterations of vague and dense generation using the REAL configured LLM,
collects:
- Hallucination surface (% of technologies/decisions not in the spec)
- Output consistency (Jaccard similarity across runs)
- Dimension resolution (% of spec constraints addressed)
- Code quality (structural completeness)

Falls back to MockLLM when no real provider is available.
"""

import json
import re
import sys
import time
from dataclasses import dataclass

from .mock_llm import MockLLM, LLMOutput, Token


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
    """Extract architectural decisions from output text for consistency measurement."""
    decisions = set()
    text = output.raw_text.lower()

    # Framework detection
    for fw in ["express", "fastapi", "hono", "django", "flask", "spring", "next.js",
                "react", "vue", "angular", "svelte", "nest.js", "koa"]:
        if fw in text:
            decisions.add(f"framework:{fw}")

    # Database detection
    for db in ["mongoose", "mongodb", "postgresql", "pg", "sqlite", "drizzle",
                "sqlalchemy", "sqlmodel", "mysql", "redis", "chromadb", "pinecone",
                "supabase", "dynamodb", "firebase"]:
        if db in text:
            decisions.add(f"database:{db}")

    # Auth detection
    for auth in ["jwt", "jsonwebtoken", "oauth", "bearer", "session", "api key",
                  "rbac", "abac", "passport"]:
        if auth in text:
            decisions.add(f"auth:{auth}")

    # Pattern detection
    for pattern in ["middleware", "schema", "model", "route", "controller",
                     "websocket", "sse", "graphql", "rest", "grpc", "microservice",
                     "monolith", "serverless", "kubernetes", "docker"]:
        if pattern in text:
            decisions.add(f"pattern:{pattern}")

    # Port detection
    ports = re.findall(r'(?:listen|port)\D*(\d{4})', text)
    for port in ports:
        decisions.add(f"port:{port}")

    return decisions


def _code_quality_score(output: LLMOutput) -> float:
    """Score structural completeness of generated code."""
    text = output.raw_text.lower()
    checks = [
        ("has_endpoints", any(x in text for x in ["app.get", "app.post", "@app.get", "@app.post",
                                                    "router.", "endpoint", "route"])),
        ("has_model", any(x in text for x in ["schema", "model", "class", "table", "entity"])),
        ("has_imports", any(x in text for x in ["import", "require", "from"])),
        ("has_error_handling", any(x in text for x in ["try", "except", "catch", "httpexception",
                                                        "status", "error"])),
        ("has_auth", any(x in text for x in ["jwt", "auth", "bearer", "token", "security"])),
        ("has_validation", any(x in text for x in ["nullable", "required", "not null", "notnull",
                                                     "validate", "zod", "pydantic"])),
        ("has_db_connection", any(x in text for x in ["engine", "pool", "connect",
                                                       "mongoose.connect", "database_url"])),
        ("has_realtime", any(x in text for x in ["websocket", "ws", "sse", "socket", "realtime"])),
    ]
    return sum(1 for _, passed in checks if passed) / len(checks)


def _estimate_hallucination(output: LLMOutput, spec_text: str) -> float:
    """Estimate hallucination by checking how many decisions are NOT grounded in the spec.

    For vague prompts (no spec), everything the LLM invents is potentially hallucinated.
    For dense prompts, compare decisions against the spec constraints.
    """
    decisions = _extract_decisions(output)
    if not decisions:
        return 0.0

    if not spec_text:
        # Vague prompt: the LLM is inventing everything — score based on
        # how many specific technologies it assumes
        return min(1.0, len(decisions) * 0.1)  # More inventions = more hallucination

    # Dense prompt: check which decisions are grounded in the spec
    spec_lower = spec_text.lower()
    grounded = 0
    for d in decisions:
        # Extract the technology name from "category:name"
        name = d.split(":")[-1]
        if name in spec_lower:
            grounded += 1

    return 1.0 - (grounded / len(decisions)) if decisions else 0.0


def _estimate_resolution(output: LLMOutput, spec_text: str) -> float:
    """Estimate what % of spec constraints are addressed in the output."""
    if not spec_text:
        return 0.2  # Vague prompt can't resolve much

    # Extract constraints from spec (lines starting with "- ")
    constraints = [line.strip("- ").lower() for line in spec_text.split("\n")
                   if line.strip().startswith("- ")]

    if not constraints:
        return 0.5

    text_lower = output.raw_text.lower()
    addressed = 0
    for c in constraints:
        # Check if key words from the constraint appear in the output
        words = set(c.split())
        significant_words = {w for w in words if len(w) > 3}  # Skip short words
        if significant_words:
            matches = sum(1 for w in significant_words if w in text_lower)
            if matches / len(significant_words) > 0.3:
                addressed += 1

    return addressed / len(constraints) if constraints else 0.0


# ── LLM adapter for comparison ──

VAGUE_SYSTEM = """You are a software architect. Generate a complete implementation plan and starter code
for the following application. Include technology choices, database schema, API endpoints,
authentication, and deployment strategy. Be thorough and specific.

Output working code with comments explaining architectural decisions."""

DENSE_SYSTEM = """You are a software architect. Generate a complete implementation that follows
the provided specification EXACTLY. Every decision MUST trace to a constraint in the spec.
Do NOT invent technologies, patterns, or configurations not in the spec.

Output working code with comments referencing specific spec constraints."""


class RealLLM:
    """Adapter that calls the actual configured LLM provider for comparison."""

    def __init__(self, config=None):
        self._config = config

    def generate(self, prompt: str, spec: str | None = None, run_index: int = 0) -> LLMOutput:
        """Generate output using the real LLM provider."""
        if not self._config:
            return self._empty_output("No LLM provider configured")

        from .llm_judge import ProviderType
        if self._config.type == ProviderType.REGEX:
            return self._empty_output("Regex provider cannot generate code")

        system = DENSE_SYSTEM if spec else VAGUE_SYSTEM
        user_prompt = prompt
        if spec:
            user_prompt = f"""Using this specification:\n\n{spec}\n\nGenerate an implementation for: {prompt}"""

        text = self._query(system, user_prompt)
        if not text:
            return self._empty_output(f"LLM query failed (run {run_index})")

        # Create LLMOutput with simple word-level tokens
        tokens = [Token(text=word + " ", grounding="grounded" if spec else "inferred")
                  for word in text.split()]
        return LLMOutput(tokens=tokens, raw_text=text)

    def _query(self, system: str, prompt: str) -> str | None:
        """Send a query to the configured provider."""
        import requests
        from .llm_judge import ProviderType

        config = self._config
        try:
            if config.type == ProviderType.OLLAMA:
                r = requests.post(
                    f"{config.base_url}/api/generate",
                    json={
                        "model": config.model,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        "options": {"temperature": 0.7, "num_predict": config.max_tokens},
                    },
                    timeout=config.timeout,
                )
                if r.status_code == 200:
                    return r.json().get("response", "")

            elif config.type == ProviderType.OPENAI:
                if not config.api_key:
                    return None
                r = requests.post(
                    f"{config.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {config.api_key}",
                             "Content-Type": "application/json"},
                    json={
                        "model": config.model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                        "max_tokens": config.max_tokens,
                    },
                    timeout=config.timeout,
                )
                if r.status_code == 200:
                    return r.json()["choices"][0]["message"]["content"]

            elif config.type == ProviderType.ANTHROPIC:
                if not config.api_key:
                    return None
                r = requests.post(
                    f"{config.base_url}/v1/messages",
                    headers={
                        "x-api-key": config.api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": config.model,
                        "max_tokens": config.max_tokens,
                        "system": system,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                    },
                    timeout=config.timeout,
                )
                if r.status_code == 200:
                    content = r.json().get("content", [])
                    return content[0]["text"] if content else None
                else:
                    print(f"[Comparator] Anthropic returned {r.status_code}: {r.text[:200]}", file=sys.stderr)

        except Exception as e:
            print(f"[Comparator] LLM query error: {e}", file=sys.stderr)

        return None

    def _empty_output(self, reason: str) -> LLMOutput:
        return LLMOutput(tokens=[], raw_text=f"# {reason}\n")


class Comparator:
    """Runs comparative analysis between vague and dense prompts."""

    def __init__(self, llm: MockLLM | RealLLM | None = None, iterations: int = 3,
                 config=None):
        if config:
            self.llm = RealLLM(config)
            self._use_real = True
        elif llm:
            self.llm = llm
            self._use_real = isinstance(llm, RealLLM)
        else:
            self.llm = MockLLM()
            self._use_real = False

        self.iterations = iterations
        self.vague_outputs: list[LLMOutput] = []
        self.dense_outputs: list[LLMOutput] = []
        self._dense_spec: str = ""
        self._progress_callback = None

    def set_progress_callback(self, callback):
        """Set a callback(step, total, message) for progress updates."""
        self._progress_callback = callback

    def _report_progress(self, step: int, total: int, message: str):
        if self._progress_callback:
            self._progress_callback(step, total, message)
        print(f"[Comparator] {step}/{total}: {message}", file=sys.stderr)

    def run(self, vague_prompt: str = "Build me a task management API with real-time updates",
            dense_spec: str = "# Dense Architecture Specification...") -> dict:
        """Run comparative analysis."""
        self.vague_outputs = []
        self.dense_outputs = []
        self._dense_spec = dense_spec
        total_steps = self.iterations * 2

        for i in range(self.iterations):
            self._report_progress(i * 2 + 1, total_steps,
                                  f"Generating vague output {i+1}/{self.iterations}")
            vague_out = self.llm.generate(vague_prompt, run_index=i)
            self.vague_outputs.append(vague_out)

            self._report_progress(i * 2 + 2, total_steps,
                                  f"Generating dense output {i+1}/{self.iterations}")
            dense_out = self.llm.generate(vague_prompt, spec=dense_spec, run_index=i)
            self.dense_outputs.append(dense_out)

        return self._compute_results()

    def _compute_results(self) -> dict:
        vague_metrics = self._compute_metrics(self.vague_outputs, spec_text="")
        dense_metrics = self._compute_metrics(self.dense_outputs, spec_text=self._dense_spec)

        return {
            "iterations": self.iterations,
            "using_real_llm": self._use_real,
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

    def _compute_metrics(self, outputs: list[LLMOutput], spec_text: str = "") -> QualityMetrics:
        if not outputs:
            return QualityMetrics(0, 0, 0, 0)

        if self._use_real:
            # Real LLM: estimate hallucination by comparing against spec
            avg_hallucination = sum(
                _estimate_hallucination(o, spec_text) for o in outputs
            ) / len(outputs)
            # Resolution: how many spec constraints are addressed
            avg_resolution = sum(
                _estimate_resolution(o, spec_text) for o in outputs
            ) / len(outputs)
        else:
            # Mock LLM: use pre-tagged token grounding
            avg_hallucination = sum(o.hallucination_surface for o in outputs) / len(outputs)
            total_tokens = sum(len(o.tokens) for o in outputs)
            grounded_tokens = sum(
                sum(1 for t in o.tokens if t.grounding == "grounded")
                for o in outputs
            )
            avg_resolution = grounded_tokens / total_tokens if total_tokens > 0 else 0.0

        # Consistency: Jaccard similarity of architectural decisions across runs
        decision_sets = [_extract_decisions(o) for o in outputs]
        consistency = _jaccard_similarity(decision_sets)

        # Code quality
        avg_quality = sum(_code_quality_score(o) for o in outputs) / len(outputs)

        return QualityMetrics(
            hallucination_surface=avg_hallucination,
            consistency=consistency,
            dimension_resolution=avg_resolution,
            code_quality=avg_quality,
        )

    def export_json(self, path: str):
        results = self._compute_results()
        with open(path, "w") as f:
            json.dump(results, f, indent=2)
