"""Reverse the SpecGenerator: take a Dense Architecture Specification markdown
and rebuild a populated ChannelRegistry from it.

The exported spec.md only carries channel-level constraint lists (sub-dimension
affinity is lost at write time). To rebuild a useful registry we route each
constraint to the most-likely sub-dimension via a small keyword heuristic, with
a deterministic fall-back to the channel's first sub-dimension.

Usage
-----
    registry = parse_markdown_to_registry(spec_md)
    # now registry.channels are filled with constraints; resolutions reflect
    # which sub-dims received content (1.0 if any constraints landed in them).

Public API: parse_markdown_to_registry(text: str) -> ChannelRegistry.
"""

from __future__ import annotations
from typing import Optional

from .channels import ChannelRegistry
from .decomposer import parse_spec  # already maps `## Section` headers → channel_id


# ── Keyword routing per sub-dimension ─────────────────────────────────────
# Lower-case substrings. First sub-dim that matches the most keywords wins;
# ties broken by sub-dim order in the channel definition. Empty match → first.
_SUB_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "purpose": {
        "objective":        ["objective", "purpose", "build", "ship", "create", "app", "service", "platform", "system"],
        "users":            ["user", "customer", "audience", "internal", "external", "persona", "team"],
        "success_criteria": ["success", "metric", "kpi", "goal", "measure", "uptime", "sla"],
        "scope":            ["scope", "feature", "boundary", "out of scope", "phase", "stage", "minimal"],
    },
    "data_model": {
        "entities":     ["entity", "table", "model", "object", "record", "row"],
        "relationships":["relation", "foreign key", "fk", "join", "reference", "between"],
        "cardinality":  ["one-to-one", "one-to-many", "many-to-many", "1:1", "1:n", "n:m", "cardinality"],
        "constraints":  ["unique", "not null", "validation", "check", "required", "optional", "constraint"],
        "indexes":      ["index", "lookup", "query", "search", "primary key", "pk"],
    },
    "api": {
        "endpoints":       ["endpoint", "path", "route", "get ", "post ", "put ", "delete ", "patch ", "url"],
        "request_shapes":  ["request", "body", "query param", "payload", "input"],
        "response_shapes": ["response", "status", "schema", "200", "201", "400", "404", "500", "output"],
        "versioning":      ["version", "v1", "v2", "deprecation"],
        "realtime":        ["websocket", "ws", "sse", "realtime", "polling", "stream"],
    },
    "tech_stack": {
        "language":      ["javascript", "typescript", "python", "go", "rust", "ruby", "java", "kotlin", "swift", "node"],
        "framework":     ["react", "vue", "next", "django", "flask", "fastapi", "express", "rails", "spring", "hono"],
        "database":      ["postgres", "postgresql", "mysql", "sqlite", "mongo", "redis", "dynamodb", "duckdb", "database"],
        "cache":         ["cache", "memcached", "redis cache", "cdn"],
        "message_queue": ["queue", "kafka", "rabbitmq", "sqs", "pubsub", "broker"],
    },
    "auth": {
        "method":        ["jwt", "oauth", "saml", "api key", "session", "bearer", "auth method", "login"],
        "authorization": ["rbac", "abac", "acl", "role", "permission", "authorization", "policy"],
        "session":       ["session", "token expir", "refresh", "lifetime", "logout"],
        "mfa":           ["mfa", "2fa", "totp", "multi-factor", "second factor"],
    },
    "deployment": {
        "infrastructure": ["aws", "gcp", "azure", "kubernetes", "k8s", "ec2", "lambda", "vercel", "fly.io", "vm", "serverless"],
        "cicd":           ["ci/cd", "pipeline", "github actions", "gitlab ci", "deploy", "build"],
        "environments":   ["dev", "staging", "prod", "preview", "environment"],
        "scaling":        ["scaling", "autoscale", "horizontal", "vertical", "replica"],
    },
    "error_handling": {
        "taxonomy":        ["error code", "status code", "exception", "error class", "taxonomy"],
        "retry":           ["retry", "backoff", "exponential", "redrive"],
        "circuit_breaker": ["circuit breaker", "fallback", "degraded", "fail open", "fail closed"],
        "logging":         ["log", "structured logging", "json log", "trace", "level"],
    },
    "performance": {
        "latency":      ["latency", "p50", "p95", "p99", "ms", "millisecond", "response time"],
        "throughput":   ["throughput", "rps", "qps", "requests per second"],
        "optimization": ["cache", "pool", "optimize", "n+1", "batch"],
        "pagination":   ["pagination", "page size", "cursor", "offset", "limit"],
    },
    "security": {
        "input_validation": ["sanitize", "validate", "input validation", "xss", "injection"],
        "encryption":       ["encrypt", "tls", "https", "aes", "rsa", "at rest", "in transit"],
        "cors":             ["cors", "origin", "preflight"],
        "rate_limiting":    ["rate limit", "throttle", "quota"],
    },
    "testing": {
        "strategy":       ["unit test", "integration test", "e2e", "smoke", "test strategy", "tdd"],
        "coverage":       ["coverage", "%", "branch coverage"],
        "test_data":      ["fixture", "factory", "test data", "seed"],
        "ci_integration": ["ci pipeline", "test in ci", "github actions test"],
    },
}


def _route_to_subdim(channel_id: str, constraint: str, sub_ids: list[str]) -> str:
    """Score each sub-dim by keyword match count; first sub-dim wins ties.

    Falls back to the first sub-dim when nothing matches — never drops the
    constraint, ensuring a round-trip never silently loses content.
    """
    text = constraint.lower()
    keyword_map = _SUB_KEYWORDS.get(channel_id, {})
    best_id = sub_ids[0]
    best_score = 0
    for sub_id in sub_ids:
        keywords = keyword_map.get(sub_id, [])
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_id = sub_id
    return best_id


def _strip_sub_label(channel_id: str, constraint: str, sub_ids: list[str]) -> tuple[str, Optional[str]]:
    """If the constraint starts with a sub-dim label (case-insensitive prefix
    match against `<SubLabel>:`), strip it and return (clean_constraint, sub_id).

    Otherwise return (constraint, None) and let keyword heuristics route it.
    """
    if ":" not in constraint:
        return constraint, None
    label_part, _, value_part = constraint.partition(":")
    label_norm = label_part.strip().lower().replace(" ", "_")
    for sub_id in sub_ids:
        if sub_id == label_norm:
            return value_part.strip(), sub_id
    return constraint, None


def parse_markdown_to_registry(text: str) -> ChannelRegistry:
    """Build a fully-initialized registry and populate it from a spec.md string.

    Two parse paths per constraint:
      1. Labelled — the constraint starts with `<SubLabel>:` (the format the
         updated SpecGenerator emits). Route directly to that sub-dim, with
         the label stripped from the stored constraint text.
      2. Unlabelled — fall back to keyword heuristics, then to the channel's
         first sub-dim if nothing matches. This keeps older / hand-written
         spec.md files round-trippable.

    Sub-dims that receive at least one constraint are marked fully resolved
    (1.0). Sub-dims with no matches stay at 0.0.
    """
    registry = ChannelRegistry()
    sections = parse_spec(text)
    for channel_id, constraints in sections.items():
        channel = registry.get(channel_id)
        if not channel:
            continue
        sub_ids = list(channel.sub_dimensions.keys())
        if not sub_ids:
            continue
        for constraint in constraints:
            stripped, label_sub = _strip_sub_label(channel_id, constraint, sub_ids)
            if label_sub:
                registry.update_resolution(channel_id, label_sub, 1.0, constraint=stripped)
            else:
                target_sub = _route_to_subdim(channel_id, constraint, sub_ids)
                registry.update_resolution(channel_id, target_sub, 1.0, constraint=constraint)
    return registry


def parse_markdown_summary(text: str) -> dict:
    """Lightweight metadata about what a spec.md contains; used for UI feedback."""
    sections = parse_spec(text)
    channel_constraints: dict[str, int] = {cid: len(cs) for cid, cs in sections.items()}
    total = sum(channel_constraints.values())
    channels_seen: list[str] = list(channel_constraints.keys())
    return {
        "total_constraints": total,
        "channels_with_content": channels_seen,
        "constraints_per_channel": channel_constraints,
    }


def parse_density_score(text: str) -> Optional[float]:
    """Best-effort: extract `# Density Score: 0.165` if present in the header."""
    for line in text.splitlines():
        s = line.strip()
        if s.lower().startswith("# density score:"):
            try:
                return float(s.split(":", 1)[1].strip())
            except (ValueError, IndexError):
                return None
    return None
