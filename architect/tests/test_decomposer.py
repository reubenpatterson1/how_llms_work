"""Unit tests for the Decomposition Engine."""

import pytest
from architect.decomposer import DecompositionEngine, parse_spec, run_decompose_programmatic
from architect.decompose_patterns import PatternComponentExtractor, _extract_entities, _extract_resources
from architect.llm_judge import ProjectPhase
from architect.wave_plan import Component, DependencyEdge


# ── Sample spec for testing ──

SAMPLE_SPEC = """# Dense Architecture Specification
# Density Score: 0.850

## Purpose
# Resolution: 100%
- Objective: collaborative task management API
- Users: engineering teams (software engineers, managers)
- Success criteria: real-time updates < 2s latency
- Scope: task CRUD, team management, real-time feed

## Data Model
# Resolution: 95%
- Entities: Task, User, Team, Comment
- Relationship: User belongs-to Team (many-to-one)
- Relationship: Task belongs-to Team (many-to-one)
- Relationship: Task has-one assignee User (many-to-one, nullable)
- Constraint: email UNIQUE NOT NULL
- Index: compound (team_id, status) for main query

## API
# Resolution: 90%
- GET/POST /v1/tasks
- GET/PUT/DELETE /v1/tasks/{id}
- GET/POST /v1/teams
- GET /v1/users/me
- WebSocket at /v1/ws/tasks/{team_id}
- Response: JSON envelope {data, meta, errors}
- Cursor-based pagination, max page size 50

## Tech Stack
# Resolution: 95%
- Language: Python 3.12
- Framework: FastAPI 0.104
- Database: PostgreSQL 15
- Cache: Redis (pub/sub for real-time)
- Message queue: not needed (Redis pub/sub sufficient)

## Auth
# Resolution: 90%
- Auth: JWT with RS256 signing
- Tokens: 15-min access, 7-day refresh with rotation
- Authorization: RBAC (admin, manager, member)
- Session: stored in Redis

## Deployment
# Resolution: 85%
- Infrastructure: AWS EKS (Kubernetes)
- CI/CD: GitHub Actions, blue-green deployment
- Environments: dev, staging, prod
- Scaling: horizontal auto-scaling, CPU target 70%

## Error Handling
# Resolution: 85%
- Taxonomy: 400, 401, 403, 404, 409, 429, 500
- Retry: exponential backoff, max 3, 1s base
- Circuit breaker: Redis, 5 failures, 30s recovery
- Logging: structured JSON, correlation IDs

## Performance
# Resolution: 90%
- Latency: P50 < 50ms, P95 < 100ms, P99 < 500ms
- Throughput: 1000 rps sustained
- Optimization: connection pooling (20 PG, 10 Redis)
- Pagination: cursor-based, max 50

## Security
# Resolution: 85%
- Input validation: Pydantic models on all endpoints
- Encryption: TLS at LB, AWS KMS at rest
- CORS: app.example.com, localhost:3000 (dev)
- Rate limiting: 100 req/min auth, 10/min auth endpoints

## Testing
# Resolution: 85%
- Strategy: unit (pytest), integration (real PG), e2e (critical paths)
- Coverage: 80% target
- Test data: factory_boy with transactional rollback
- CI integration: GitHub Actions on every PR

## All Constraints (Flat)
- Objective: collaborative task management API
- Language: Python 3.12

## Implementation Rules
- Every architectural decision MUST trace to a constraint above
- If a dimension has no constraint, ASK — do not invent
- Prefer explicit over implicit in all generated code
- No defaults: every value must come from this spec
"""


class TestParseSpec:
    def test_parses_all_channels(self):
        sections = parse_spec(SAMPLE_SPEC)
        assert "purpose" in sections
        assert "data_model" in sections
        assert "api" in sections
        assert "tech_stack" in sections
        assert "auth" in sections
        assert "deployment" in sections
        assert "error_handling" in sections
        assert "performance" in sections
        assert "security" in sections
        assert "testing" in sections

    def test_skips_meta_sections(self):
        sections = parse_spec(SAMPLE_SPEC)
        assert "all constraints (flat)" not in sections
        assert "implementation rules" not in sections

    def test_extracts_constraints(self):
        sections = parse_spec(SAMPLE_SPEC)
        assert len(sections["purpose"]) == 4
        assert any("task management" in c.lower() for c in sections["purpose"])

    def test_data_model_constraints(self):
        sections = parse_spec(SAMPLE_SPEC)
        dm = sections["data_model"]
        assert len(dm) >= 4
        assert any("Task" in c for c in dm)


class TestEntityExtraction:
    def test_extracts_comma_separated(self):
        entities = _extract_entities(["Entities: Task, User, Team, Comment"])
        assert entities == ["Task", "User", "Team", "Comment"]

    def test_extracts_single_entity(self):
        entities = _extract_entities(["Core entity: User"])
        assert entities == ["User"]

    def test_deduplicates(self):
        entities = _extract_entities([
            "Entities: Task, User",
            "Entity: Task",
        ])
        assert entities == ["Task", "User"]


class TestResourceExtraction:
    def test_extracts_from_methods(self):
        resources = _extract_resources([
            "GET/POST /v1/tasks",
            "GET /v1/users/me",
        ])
        assert "task" in resources
        assert "user" in resources

    def test_strips_trailing_s(self):
        resources = _extract_resources(["GET /v1/teams"])
        assert "team" in resources


class TestPatternExtractor:
    def test_extracts_model_components(self):
        sections = parse_spec(SAMPLE_SPEC)
        extractor = PatternComponentExtractor()
        components, edges = extractor.extract(sections)

        model_comps = [c for c in components if c.component_type == "model"]
        assert len(model_comps) >= 3  # Task, User, Team at minimum
        names = {c.name for c in model_comps}
        assert "TaskModel" in names
        assert "UserModel" in names

    def test_extracts_auth_components(self):
        sections = parse_spec(SAMPLE_SPEC)
        extractor = PatternComponentExtractor()
        components, edges = extractor.extract(sections)

        auth_comps = [c for c in components if "auth" in c.id]
        assert len(auth_comps) >= 2  # AuthService + AuthMiddleware

    def test_extracts_handler_components(self):
        sections = parse_spec(SAMPLE_SPEC)
        extractor = PatternComponentExtractor()
        components, edges = extractor.extract(sections)

        handlers = [c for c in components if c.component_type == "handler"]
        assert len(handlers) >= 2  # task-handler, team-handler at minimum

    def test_builds_dependency_edges(self):
        sections = parse_spec(SAMPLE_SPEC)
        extractor = PatternComponentExtractor()
        components, edges = extractor.extract(sections)

        assert len(edges) > 0
        # Handlers should depend on services/models
        handler_deps = [e for e in edges if e.from_component.endswith("-handler")]
        assert len(handler_deps) > 0

    def test_generates_interfaces(self):
        sections = parse_spec(SAMPLE_SPEC)
        extractor = PatternComponentExtractor()
        components, edges = extractor.extract(sections)
        interfaces = extractor.generate_interfaces(components, sections)

        assert len(interfaces) > 0
        names = {i.name for i in interfaces}
        assert "IUserRepository" in names or "ITaskRepository" in names


class TestDecompositionEngine:
    def test_decompose_produces_waves(self):
        engine = DecompositionEngine(phase=ProjectPhase.MVP)
        plan = engine.decompose(SAMPLE_SPEC)

        assert plan.metrics.total_waves >= 2
        assert plan.metrics.total_components >= 5
        assert plan.phase == "mvp"

    def test_wave_ordering(self):
        engine = DecompositionEngine(phase=ProjectPhase.MVP)
        plan = engine.decompose(SAMPLE_SPEC)

        # Earlier waves should have foundational types (config, model)
        # Later waves should have consumer types (handler, test)
        first_non_interface = None
        last_wave = plan.waves[-1]

        for wave in plan.waves:
            types = {c.component_type for c in wave.components}
            if types - {"interface"}:
                first_non_interface = wave
                break

        if first_non_interface:
            first_types = {c.component_type for c in first_non_interface.components}
            assert first_types & {"config", "model"}, f"First wave types: {first_types}"

    def test_time_savings(self):
        engine = DecompositionEngine(phase=ProjectPhase.MVP)
        plan = engine.decompose(SAMPLE_SPEC)

        # With multiple components per wave, should see time savings
        assert plan.metrics.time_savings_percent > 0
        assert plan.metrics.estimated_parallel_minutes < plan.metrics.estimated_sequential_minutes

    def test_poc_has_fewer_components(self):
        mvp_engine = DecompositionEngine(phase=ProjectPhase.MVP)
        poc_engine = DecompositionEngine(phase=ProjectPhase.POC)

        mvp_plan = mvp_engine.decompose(SAMPLE_SPEC)
        poc_plan = poc_engine.decompose(SAMPLE_SPEC)

        # PoC should prune optional-channel-only components
        assert poc_plan.metrics.total_components <= mvp_plan.metrics.total_components

    def test_poc_has_fewer_waves(self):
        poc_engine = DecompositionEngine(phase=ProjectPhase.POC)
        poc_plan = poc_engine.decompose(SAMPLE_SPEC)
        assert poc_plan.metrics.total_waves <= 3

    def test_preprod_keeps_all(self):
        engine = DecompositionEngine(phase=ProjectPhase.PREPROD)
        plan = engine.decompose(SAMPLE_SPEC)

        # PreProd should keep everything
        channels_present = set()
        for wave in plan.waves:
            for comp in wave.components:
                channels_present.update(comp.channel_sources)

        # Should have components from most channels
        assert len(channels_present) >= 5

    def test_dependency_graph_populated(self):
        engine = DecompositionEngine(phase=ProjectPhase.MVP)
        plan = engine.decompose(SAMPLE_SPEC)

        assert len(plan.dependency_graph) > 0

    def test_interfaces_populated(self):
        engine = DecompositionEngine(phase=ProjectPhase.MVP)
        plan = engine.decompose(SAMPLE_SPEC)

        assert len(plan.interfaces) > 0

    def test_method_used_is_regex(self):
        """Without LLM config, should use regex."""
        engine = DecompositionEngine(phase=ProjectPhase.MVP)
        engine.decompose(SAMPLE_SPEC)
        assert engine.method_used == "regex"


class TestRunDecomposeProgrammatic:
    def test_returns_wave_plan(self):
        plan = run_decompose_programmatic(SAMPLE_SPEC, phase="mvp")
        assert plan.metrics.total_components > 0
        assert plan.metrics.total_waves > 0

    def test_phase_parameter(self):
        plan = run_decompose_programmatic(SAMPLE_SPEC, phase="poc")
        assert plan.phase == "poc"
