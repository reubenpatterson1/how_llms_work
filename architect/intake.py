"""Intake engine that drives structured Q&A to resolve architectural channels.

Generates contextual questions based on what the user has described so far,
targeting the lowest-resolution channels. Uses the LLM to produce relevant
questions when available, falling back to generic templates.
"""

import json
import re
import sys
import requests
from dataclasses import dataclass, field

from .channels import ChannelRegistry
from .analyzer import ResponseAnalyzer, DimensionUpdate, Ambiguity


@dataclass
class IntakeResult:
    updates: list[DimensionUpdate]
    ambiguities: list[Ambiguity]
    next_question: str | None
    snapshot: dict
    is_complete: bool


# ── Generic question templates (used when LLM is unavailable) ──
# These are domain-agnostic and reference the sub-dimension descriptions directly.
GENERIC_TEMPLATES: dict[str, list[str]] = {
    "purpose": [
        "What is the primary objective of this application? Who are the target users and what problem does it solve?",
        "What are the measurable success criteria? How will you know this project succeeded?",
        "What's in scope and what's explicitly out of scope for the initial release?",
    ],
    "data_model": [
        "What are the core entities in your system? Describe their key attributes and how they relate to each other.",
        "What are the relationship rules between entities? (e.g., one-to-many, many-to-many, ownership hierarchies)",
        "What uniqueness constraints, validation rules, and query patterns do you need?",
    ],
    "api": [
        "What API style will you use (REST, GraphQL, gRPC)? What are the primary operations?",
        "Describe the request and response shapes for your most important endpoints.",
        "Do you need real-time capabilities (WebSocket, SSE)? How will you version the API?",
    ],
    "tech_stack": [
        "What programming language and framework will you use? Specify versions if known.",
        "What database engine will you use? Do you need caching or a message queue?",
        "Are there other infrastructure components (search, CDN, object storage)?",
    ],
    "auth": [
        "How will users authenticate? (JWT, OAuth 2.0, API keys, session-based, etc.)",
        "What's the authorization model? Describe the roles and their permissions.",
        "How will you manage sessions and tokens? Do you need MFA?",
    ],
    "deployment": [
        "Where will this be deployed? (Cloud provider, Kubernetes, serverless, VMs)",
        "What's your CI/CD pipeline and deployment strategy?",
        "How many environments do you need and what's the scaling strategy?",
    ],
    "error_handling": [
        "How should errors be categorized and what status codes map to each category?",
        "What retry and circuit breaker policies do you need?",
        "What logging format, levels, and correlation strategy will you use?",
    ],
    "performance": [
        "What are your latency targets? (P50, P95, P99)",
        "What throughput and concurrency do you need to support?",
        "What optimization strategies will you use? (caching, pooling, pagination)",
    ],
    "security": [
        "What input validation and sanitization rules do you need?",
        "What encryption requirements do you have? (TLS, at-rest, field-level)",
        "What CORS policy and rate limiting thresholds do you need?",
    ],
    "testing": [
        "What's your test strategy? (unit, integration, e2e split)",
        "What code coverage targets do you have?",
        "How will you manage test data? How do tests run in CI?",
    ],
}

# Prompt for generating contextual follow-up questions
QUESTION_GEN_PROMPT = """You are helping gather architecture requirements for a software project.

Based on what the user has described so far, generate ONE specific follow-up question
to fill gaps in the "{channel_name}" dimension.

What we know so far about this project:
{context}

The {channel_name} channel has these unresolved sub-dimensions:
{unresolved_subs}

Current constraints already collected for {channel_name}:
{existing_constraints}

Generate a single, specific question that:
1. References the actual entities, technologies, and domain the user described
2. Targets the unresolved sub-dimensions listed above
3. Does NOT use generic examples from unrelated domains
4. Is direct and actionable

Return ONLY the question text, nothing else."""


class IntakeEngine:
    """Drives structured intake Q&A to fill architectural channels."""

    def __init__(self, registry: ChannelRegistry | None = None, threshold: float = 0.8):
        self.registry = registry or ChannelRegistry()
        self.analyzer = ResponseAnalyzer()
        self.threshold = threshold
        self.history: list[dict] = []
        self._question_index: dict[str, int] = {ch_id: 0 for ch_id in GENERIC_TEMPLATES}
        self._snapshots: list[dict] = []
        self._app_description: str = ""  # Accumulated context about the app
        self._llm_config = None  # Set externally by webapp
        self._critical_channels: set[str] = set()  # Phase-aware: only these must hit threshold
        self._asked_questions: list[str] = []  # Track questions to avoid repeats

    def set_llm_config(self, config):
        """Set the LLM config for contextual question generation."""
        self._llm_config = config

    def set_critical_channels(self, channels: set[str]):
        """Set which channels are critical for the current phase.
        When set, is_complete() only checks these channels."""
        self._critical_channels = channels

    def process_response(self, response: str) -> IntakeResult:
        updates = self.analyzer.analyze(response)
        ambiguities = self.analyzer.identify_ambiguities(response)

        for update in updates:
            self.registry.update_resolution(
                update.channel_id, update.sub_dimension,
                update.resolution, update.constraint,
            )

        # Accumulate app context from responses
        self._app_description += " " + response

        self.history.append({
            "response": response,
            "updates": [{"channel": u.channel_id, "sub": u.sub_dimension,
                         "resolution": u.resolution, "constraint": u.constraint}
                        for u in updates],
            "ambiguities": [{"text": a.text, "reason": a.reason} for a in ambiguities],
        })

        snapshot = self.registry.snapshot()
        self._snapshots.append(snapshot)

        complete = self.is_complete()
        next_q = None if complete else self._next_question()

        return IntakeResult(
            updates=updates,
            ambiguities=ambiguities,
            next_question=next_q,
            snapshot=snapshot,
            is_complete=complete,
        )

    def is_complete(self, threshold: float | None = None) -> bool:
        t = threshold if threshold is not None else self.threshold
        if self._critical_channels:
            # Phase-aware: only critical channels must hit threshold
            return all(
                ch.resolution >= t
                for ch_id, ch in self.registry.channels.items()
                if ch_id in self._critical_channels
            )
        return all(ch.resolution >= t for ch in self.registry.channels.values())

    def get_snapshots(self) -> list[dict]:
        return list(self._snapshots)

    def _next_question(self) -> str:
        # Only target critical channels if phase-aware
        if self._critical_channels:
            unresolved = [
                ch for ch_id, ch in self.registry.channels.items()
                if ch_id in self._critical_channels and ch.resolution < self.threshold
            ]
        else:
            unresolved = self.registry.get_unresolved(self.threshold)

        if not unresolved:
            return "All channels resolved. Ready to generate specification."

        # Sort by resolution ascending — target the least resolved channel
        unresolved.sort(key=lambda ch: ch.resolution)
        target = unresolved[0]

        # Try LLM-generated contextual question first
        if self._app_description.strip() and self._llm_config:
            llm_question = self._generate_contextual_question(target)
            if llm_question and not self._is_repeat_question(llm_question):
                self._asked_questions.append(llm_question)
                return llm_question

        # Fall back to generic templates
        question = self._generic_question(target)
        self._asked_questions.append(question)
        return question

    def _is_repeat_question(self, question: str) -> bool:
        """Check if a question is too similar to one already asked."""
        q_lower = question.lower().strip()
        # Remove punctuation for comparison
        q_clean = re.sub(r'[^\w\s]', '', q_lower)
        q_words = set(q_clean.split())

        for prev in self._asked_questions:
            prev_lower = prev.lower().strip()
            prev_clean = re.sub(r'[^\w\s]', '', prev_lower)
            p_words = set(prev_clean.split())

            # Exact or near-exact match
            if q_clean == prev_clean:
                return True

            # Word overlap check (Jaccard > 0.6 = too similar)
            if q_words and p_words:
                overlap = len(q_words & p_words) / len(q_words | p_words)
                if overlap > 0.6:
                    return True

                # Also check: do 80%+ of the shorter question's words appear in the longer?
                shorter, longer = (q_words, p_words) if len(q_words) < len(p_words) else (p_words, q_words)
                if shorter:
                    containment = len(shorter & longer) / len(shorter)
                    if containment > 0.8:
                        return True

        return False

    def _generate_contextual_question(self, target) -> str | None:
        """Use the LLM to generate a context-aware follow-up question."""
        from .llm_judge import ProviderType, query_ollama, query_openai, query_anthropic

        config = self._llm_config
        if not config or config.type == ProviderType.REGEX:
            return None

        # Build context
        context_lines = []
        for ch_id, ch in self.registry.channels.items():
            if ch.constraints:
                context_lines.append(f"  {ch.name}: {'; '.join(ch.constraints[:5])}")
        context = "\n".join(context_lines) if context_lines else "No constraints collected yet."

        # Unresolved sub-dimensions for the target channel
        low_subs = target.get_unresolved(self.threshold)
        unresolved_subs = "\n".join(
            f"  - {s.name}: {s.description} (currently {s.resolution:.0%})"
            for s in low_subs
        )

        existing = "\n".join(f"  - {c}" for c in target.constraints) if target.constraints else "  (none yet)"

        prompt = QUESTION_GEN_PROMPT.format(
            channel_name=target.name,
            context=context,
            unresolved_subs=unresolved_subs,
            existing_constraints=existing,
        )

        try:
            # Use a lightweight request — we just need one question
            from .llm_judge import ProviderConfig
            light_config = ProviderConfig(
                type=config.type,
                model=config.model,
                api_key=config.api_key,
                base_url=config.base_url,
                temperature=0.3,  # Slightly higher for natural questions
                max_tokens=256,   # Short response needed
                timeout=15,       # Quick timeout — fall back if slow
            )

            result_text = None
            if config.type == ProviderType.OLLAMA:
                result_text = self._query_text_ollama(light_config, prompt)
            elif config.type == ProviderType.OPENAI:
                result_text = self._query_text_openai(light_config, prompt)
            elif config.type == ProviderType.ANTHROPIC:
                result_text = self._query_text_anthropic(light_config, prompt)

            if result_text and len(result_text.strip()) > 10:
                # Clean up: take first paragraph/sentence if multiple
                question = result_text.strip().split("\n")[0].strip()
                # Remove any markdown or prefix
                if question.startswith(("- ", "* ", "Q: ", "Question: ")):
                    question = question.split(": ", 1)[-1] if ": " in question else question[2:]
                return question

        except Exception as e:
            print(f"[Intake] Contextual question generation failed: {e}", file=sys.stderr)

        return None

    def _query_text_ollama(self, config, prompt: str) -> str | None:
        try:
            r = requests.post(
                f"{config.base_url}/api/generate",
                json={
                    "model": config.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": config.temperature, "num_predict": config.max_tokens},
                },
                timeout=config.timeout,
            )
            if r.status_code == 200:
                return r.json().get("response", "")
        except (requests.ConnectionError, requests.Timeout):
            pass
        return None

    def _query_text_openai(self, config, prompt: str) -> str | None:
        if not config.api_key:
            return None
        try:
            r = requests.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"},
                json={
                    "model": config.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens,
                },
                timeout=config.timeout,
            )
            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"]
        except (requests.ConnectionError, requests.Timeout, KeyError):
            pass
        return None

    def _query_text_anthropic(self, config, prompt: str) -> str | None:
        if not config.api_key:
            return None
        try:
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
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": config.temperature,
                },
                timeout=config.timeout,
            )
            if r.status_code == 200:
                content = r.json().get("content", [])
                return content[0]["text"] if content else None
        except (requests.ConnectionError, requests.Timeout, KeyError, IndexError):
            pass
        return None

    def _generic_question(self, target) -> str:
        """Fall back to generic template questions."""
        templates = GENERIC_TEMPLATES.get(target.id, [])
        if not templates:
            return f"Tell me more about {target.name} ({target.description})."

        idx = self._question_index.get(target.id, 0)
        if idx >= len(templates):
            # All templates exhausted — ask about specific unresolved subs
            low_subs = target.get_unresolved(self.threshold)
            if low_subs:
                sub_names = ", ".join(s.description for s in low_subs[:3])
                return f"I still need more specifics on {target.name}. Can you clarify: {sub_names}?"
            return f"Can you provide more details about {target.name}?"

        question = templates[idx]
        self._question_index[target.id] = idx + 1
        return question

    def first_question(self) -> str:
        return self._next_question()
