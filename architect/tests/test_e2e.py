"""End-to-end test: full pipeline from intake to comparative data export.

This test generates test_results.json used by the presentation.
"""

import json
import os

import pytest
from architect.agent import run_programmatic
from architect.comparator import Comparator
from architect.mock_llm import MockLLM


# Scripted responses for "Task Management API with Real-Time Updates"
# Each response is designed to resolve multiple channels simultaneously
SCRIPTED_RESPONSES = [
    # Response 1: Purpose + high-level scope
    "Build a collaborative task management API for engineering teams. "
    "Target users are software engineers and engineering managers. "
    "Success criteria: teams can create, assign, track, and complete tasks "
    "with real-time status updates. Scope includes task CRUD, team management, "
    "assignment workflows, and a real-time notification feed. "
    "KPI: 95% of task state changes reflected in under 2 seconds.",

    # Response 2: Data model
    "Core entities: User (id, email UNIQUE NOT NULL, name, role), "
    "Team (id, name UNIQUE, created_at), "
    "Task (id, title NOT NULL, description, status, priority, assignee_id FK users, team_id FK teams). "
    "User belongs to one Team (one-to-many). Task belongs to one Team (one-to-many). "
    "Task has one assignee User (many-to-one, nullable). "
    "Compound index on (team_id, status) for the main query pattern. "
    "Index on assignee_id for user dashboard queries.",

    # Response 3: Tech stack
    "Python 3.12 with FastAPI 0.104. PostgreSQL 15 for primary storage. "
    "Redis for caching and pub/sub for real-time events. "
    "No message queue needed — Redis pub/sub is sufficient for our scale.",

    # Response 4: API + realtime
    "RESTful API with URL-path versioning (v1). "
    "Endpoints: GET/POST /v1/tasks, GET/PUT/DELETE /v1/tasks/{id}, "
    "GET/POST /v1/teams, GET /v1/users/me. "
    "Request bodies: JSON with Pydantic validation. "
    "Response: JSON with consistent envelope {data, meta, errors}. "
    "WebSocket at /v1/ws/tasks/{team_id} for real-time task updates. "
    "Cursor-based pagination with max page size 50.",

    # Response 5: Auth
    "JWT authentication with RS256 signing. "
    "15-minute access tokens, 7-day refresh tokens with rotation. "
    "RBAC authorization: admin (full access), manager (team CRUD + assign), member (own tasks). "
    "No MFA required for v1. Session stored in Redis.",

    # Response 6: Deployment
    "Deploy on AWS with Kubernetes (EKS). "
    "Docker containers, GitHub Actions for CI/CD. "
    "Blue-green deployment strategy. "
    "Three environments: dev, staging, prod. "
    "Horizontal auto-scaling based on CPU (target 70%).",

    # Response 7: Error handling + logging
    "Error taxonomy: 400 validation, 401 auth, 403 forbidden, 404 not found, "
    "409 conflict, 429 rate limit, 500 internal. "
    "Retry with exponential backoff for upstream calls (max 3 retries, 1s base). "
    "Circuit breaker on Redis with 5-failure threshold, 30s recovery. "
    "Structured JSON logging with correlation IDs. Log levels: DEBUG, INFO, WARN, ERROR.",

    # Response 8: Performance
    "P50 < 50ms, P95 < 100ms, P99 < 500ms for all REST endpoints. "
    "Target 1000 rps sustained. "
    "Connection pooling: 20 PostgreSQL connections, 10 Redis connections. "
    "Cache hot queries in Redis with 60s TTL.",

    # Response 9: Security
    "Input validation via Pydantic models on all endpoints. "
    "TLS termination at load balancer, encryption at rest via AWS KMS. "
    "CORS: allow app.example.com and localhost:3000 (dev only). "
    "Rate limiting: 100 requests/minute per authenticated user, 10/min for auth endpoints.",

    # Response 10: Testing
    "Unit tests for business logic (pytest), integration tests hitting real PostgreSQL. "
    "E2e tests for critical paths (create task → assign → complete → WebSocket notification). "
    "80% code coverage target. "
    "Test fixtures via factory_boy with transactional rollback. "
    "Tests run in GitHub Actions CI on every PR.",
]


class TestEndToEnd:
    def test_full_pipeline(self):
        """Run full intake → spec → comparison pipeline."""
        # Phase 1: Run intake with scripted responses
        spec, registry, snapshots = run_programmatic(SCRIPTED_RESPONSES)

        # Verify spec was generated
        assert "Dense Architecture Specification" in spec
        assert registry.overall_density_score() > 0.5

        # Verify snapshots show progressive resolution
        assert len(snapshots) >= 5
        scores = [s["density_score"] for s in snapshots]
        # Scores should generally increase (allow some non-monotonicity)
        assert scores[-1] > scores[0]

        # Phase 2: Run comparative analysis
        comp = Comparator(iterations=5)
        results = comp.run(
            vague_prompt="Build me a task management API with real-time updates",
            dense_spec=spec,
        )

        # Verify vague is measurably worse
        assert results["vague"]["metrics"]["hallucination_surface"] > \
               results["dense"]["metrics"]["hallucination_surface"]

        # Add channel resolution snapshots to results
        results["channel_resolution_over_time"] = snapshots
        results["spec"] = spec
        results["density_score"] = registry.overall_density_score()

        # Phase 3: Export
        output_path = os.path.join(os.path.dirname(__file__), "..", "test_results.json")
        output_path = os.path.normpath(output_path)
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)

        # Verify file was written
        assert os.path.exists(output_path)
        with open(output_path) as f:
            data = json.load(f)
        assert "vague" in data
        assert "dense" in data
        assert "channel_resolution_over_time" in data

    def test_spec_has_all_resolved_channels(self):
        spec, registry, _ = run_programmatic(SCRIPTED_RESPONSES)
        # Check that key channels appear in spec
        assert "Tech Stack" in spec
        assert "Auth" in spec
        assert "API" in spec
        assert "Data Model" in spec

    def test_density_above_threshold(self):
        _, registry, _ = run_programmatic(SCRIPTED_RESPONSES)
        # With comprehensive responses, density should be high
        assert registry.overall_density_score() > 0.4

    def test_snapshots_are_progressive(self):
        _, _, snapshots = run_programmatic(SCRIPTED_RESPONSES)
        # First snapshot should have lower density than last
        assert snapshots[-1]["density_score"] > snapshots[0]["density_score"]
