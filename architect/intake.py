"""Intake engine that drives structured Q&A to resolve architectural channels.

Generates targeted questions based on lowest-resolution channels, processes
responses through the analyzer, and tracks resolution progress.
"""

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


# Question templates per channel — each targets the lowest-resolution sub-dimensions
QUESTION_TEMPLATES: dict[str, list[str]] = {
    "purpose": [
        "What is the primary objective of this application? Who are the target users and what problem does it solve for them?",
        "What are the measurable success criteria? How will you know this project succeeded?",
        "What's in scope and what's explicitly out of scope for the initial release?",
    ],
    "data_model": [
        "What are the core entities in your domain? Describe their key attributes and how they relate to each other.",
        "What are the cardinality rules? (e.g., can a user belong to multiple teams? Can a task have multiple assignees?)",
        "What uniqueness constraints, validation rules, and indexes do you need? What are your most common query patterns?",
    ],
    "api": [
        "What API style will you use (REST, GraphQL, gRPC)? List the primary endpoints/operations.",
        "Describe the request and response shapes for your most important endpoints.",
        "Do you need real-time capabilities (WebSocket, SSE, polling)? How will you version the API?",
    ],
    "tech_stack": [
        "What programming language and web framework will you use? Specify versions if known.",
        "What database engine will you use? Do you need a caching layer or message queue?",
        "Are there any other infrastructure components (search engine, CDN, object storage)?",
    ],
    "auth": [
        "How will users authenticate? (JWT, OAuth 2.0, API keys, session-based, etc.)",
        "What's the authorization model? (RBAC, ABAC, ACL) Describe the roles and permissions.",
        "How will you manage sessions/tokens? Do you need MFA or refresh token rotation?",
    ],
    "deployment": [
        "Where will this be deployed? (Cloud provider, Kubernetes, serverless, VMs)",
        "What's your CI/CD pipeline? How will you handle deployments (blue-green, canary, rolling)?",
        "How many environments do you need? What's the scaling strategy?",
    ],
    "error_handling": [
        "How should errors be categorized and what HTTP status codes map to each category?",
        "What retry and backoff policies do you need? Are there circuit breaker requirements?",
        "What logging format and levels will you use? Any structured logging requirements?",
    ],
    "performance": [
        "What are your latency targets? (P50, P95, P99 per endpoint or overall)",
        "What throughput do you need to support? (requests/second, concurrent users)",
        "What optimization strategies will you use? (caching, connection pooling, pagination style)",
    ],
    "security": [
        "What input validation and sanitization rules do you need?",
        "What encryption requirements do you have? (TLS, encryption at rest, field-level)",
        "What CORS policy and rate limiting thresholds do you need?",
    ],
    "testing": [
        "What's your test strategy? (unit, integration, e2e split and priorities)",
        "What code coverage targets do you have?",
        "How will you manage test data and fixtures? How do tests run in CI?",
    ],
}


class IntakeEngine:
    """Drives structured intake Q&A to fill architectural channels."""

    def __init__(self, registry: ChannelRegistry | None = None, threshold: float = 0.8):
        self.registry = registry or ChannelRegistry()
        self.analyzer = ResponseAnalyzer()
        self.threshold = threshold
        self.history: list[dict] = []
        self._question_index: dict[str, int] = {ch_id: 0 for ch_id in QUESTION_TEMPLATES}
        self._snapshots: list[dict] = []

    def process_response(self, response: str) -> IntakeResult:
        updates = self.analyzer.analyze(response)
        ambiguities = self.analyzer.identify_ambiguities(response)

        for update in updates:
            self.registry.update_resolution(
                update.channel_id, update.sub_dimension,
                update.resolution, update.constraint,
            )

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
        return all(ch.resolution >= t for ch in self.registry.channels.values())

    def get_snapshots(self) -> list[dict]:
        return list(self._snapshots)

    def _next_question(self) -> str:
        unresolved = self.registry.get_unresolved(self.threshold)
        if not unresolved:
            return "All channels resolved. Ready to generate specification."

        # Sort by resolution ascending — target the least resolved channel
        unresolved.sort(key=lambda ch: ch.resolution)
        target = unresolved[0]

        templates = QUESTION_TEMPLATES.get(target.id, [])
        if not templates:
            return f"Tell me more about {target.name} ({target.description})."

        idx = self._question_index.get(target.id, 0)
        if idx >= len(templates):
            # All templates exhausted — ask a generic follow-up
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
