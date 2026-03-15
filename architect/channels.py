"""Channel-based architectural dimension tracking.

Each Channel represents an architectural dimension (e.g., Data Model, Auth, API)
with sub-dimensions that track resolution from 0.0 (unresolved) to 1.0 (fully specified).
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SubDimension:
    name: str
    description: str
    resolution: float = 0.0
    constraints: list[str] = field(default_factory=list)

    def update(self, resolution: float, constraint: Optional[str] = None):
        # Never downgrade resolution — take the max of existing and new
        self.resolution = min(1.0, max(self.resolution, resolution))
        if constraint and constraint not in self.constraints:
            self.constraints.append(constraint)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "resolution": self.resolution,
            "constraints": list(self.constraints),
        }


@dataclass
class Channel:
    id: str
    name: str
    description: str
    sub_dimensions: dict[str, SubDimension] = field(default_factory=dict)

    @property
    def resolution(self) -> float:
        if not self.sub_dimensions:
            return 0.0
        return sum(sd.resolution for sd in self.sub_dimensions.values()) / len(self.sub_dimensions)

    @property
    def constraints(self) -> list[str]:
        out = []
        for sd in self.sub_dimensions.values():
            out.extend(sd.constraints)
        return out

    def get_unresolved(self, threshold: float = 0.8) -> list[SubDimension]:
        return [sd for sd in self.sub_dimensions.values() if sd.resolution < threshold]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "resolution": round(self.resolution, 3),
            "constraints": self.constraints,
            "sub_dimensions": {k: v.to_dict() for k, v in self.sub_dimensions.items()},
        }


def _make_channel(id: str, name: str, description: str, subs: list[tuple[str, str]]) -> Channel:
    ch = Channel(id=id, name=name, description=description)
    for sub_id, sub_desc in subs:
        ch.sub_dimensions[sub_id] = SubDimension(name=sub_id, description=sub_desc)
    return ch


class ChannelRegistry:
    """Registry of 10 architectural channels with sub-dimensions."""

    def __init__(self):
        self.channels: dict[str, Channel] = {}
        self._init_channels()

    def _init_channels(self):
        defs = [
            ("purpose", "Purpose", "Application objectives, user stories, success criteria", [
                ("objective", "Primary application objective"),
                ("users", "Target user personas"),
                ("success_criteria", "Measurable success criteria"),
                ("scope", "Feature scope and boundaries"),
            ]),
            ("data_model", "Data Model", "Entities, relationships, cardinality, constraints, indexes", [
                ("entities", "Core domain entities and attributes"),
                ("relationships", "Entity relationships and cardinality"),
                ("cardinality", "One-to-one, one-to-many, many-to-many specifics"),
                ("constraints", "Uniqueness, nullability, validation rules"),
                ("indexes", "Query patterns and index strategy"),
            ]),
            ("api", "API", "Endpoints, methods, request/response shapes, versioning", [
                ("endpoints", "Resource paths and HTTP methods"),
                ("request_shapes", "Request body and query parameter schemas"),
                ("response_shapes", "Response body schemas and status codes"),
                ("versioning", "API versioning strategy"),
                ("realtime", "WebSocket, SSE, or polling requirements"),
            ]),
            ("tech_stack", "Tech Stack", "Languages, frameworks, databases, infrastructure", [
                ("language", "Programming language and version"),
                ("framework", "Web framework and version"),
                ("database", "Database engine and version"),
                ("cache", "Caching layer and strategy"),
                ("message_queue", "Message broker or event bus"),
            ]),
            ("auth", "Auth", "Authentication method, authorization model, session management", [
                ("method", "Authentication mechanism (JWT, OAuth, API key, etc.)"),
                ("authorization", "Authorization model (RBAC, ABAC, ACL)"),
                ("session", "Session management and token lifecycle"),
                ("mfa", "Multi-factor authentication requirements"),
            ]),
            ("deployment", "Deployment", "Infrastructure, CI/CD, environments, scaling", [
                ("infrastructure", "Cloud provider and compute (K8s, serverless, VMs)"),
                ("cicd", "CI/CD pipeline and deployment strategy"),
                ("environments", "Environment tiers (dev, staging, prod)"),
                ("scaling", "Horizontal/vertical scaling strategy"),
            ]),
            ("error_handling", "Error Handling", "Error taxonomy, retry policies, circuit breakers, logging", [
                ("taxonomy", "Error categories and HTTP status mapping"),
                ("retry", "Retry policies and backoff strategies"),
                ("circuit_breaker", "Circuit breaker thresholds and fallbacks"),
                ("logging", "Structured logging format and levels"),
            ]),
            ("performance", "Performance", "Latency targets, throughput, optimization strategy", [
                ("latency", "P50/P95/P99 latency targets per endpoint"),
                ("throughput", "Requests per second targets"),
                ("optimization", "Caching, connection pooling, query optimization"),
                ("pagination", "Pagination strategy for list endpoints"),
            ]),
            ("security", "Security", "Input validation, encryption, CORS, rate limiting", [
                ("input_validation", "Input sanitization and validation rules"),
                ("encryption", "Encryption at rest and in transit"),
                ("cors", "CORS policy and allowed origins"),
                ("rate_limiting", "Rate limiting strategy and thresholds"),
            ]),
            ("testing", "Testing", "Test strategy, coverage targets, test data management", [
                ("strategy", "Unit, integration, e2e test split"),
                ("coverage", "Code coverage targets"),
                ("test_data", "Test data management and fixtures"),
                ("ci_integration", "Test execution in CI pipeline"),
            ]),
        ]
        for ch_id, name, desc, subs in defs:
            self.channels[ch_id] = _make_channel(ch_id, name, desc, subs)

    def get(self, channel_id: str) -> Optional[Channel]:
        return self.channels.get(channel_id)

    def get_unresolved(self, threshold: float = 0.8) -> list[Channel]:
        return [ch for ch in self.channels.values() if ch.resolution < threshold]

    def update_resolution(self, channel_id: str, sub_id: str, resolution: float, constraint: Optional[str] = None):
        ch = self.channels.get(channel_id)
        if ch and sub_id in ch.sub_dimensions:
            ch.sub_dimensions[sub_id].update(resolution, constraint)

    def overall_density_score(self) -> float:
        if not self.channels:
            return 0.0
        return sum(ch.resolution for ch in self.channels.values()) / len(self.channels)

    def snapshot(self) -> dict:
        return {
            "density_score": round(self.overall_density_score(), 3),
            "channels": {k: v.to_dict() for k, v in self.channels.items()},
        }

    def to_dict(self) -> dict:
        return self.snapshot()
