"""Regression tests: PoC auto-defaults must not fabricate an auth channel.

Bug: IntakeEngine.auto_resolve_poc_defaults() seeded auth.mfa and auth.session,
which pushed Channel("auth").resolution to 0.4. SpecGenerator only skips a
channel when resolution < 0.01, so a real "## Auth" section appeared in the
dense spec for apps that never mentioned authentication, and the decomposer's
pattern extractor turned that section into AuthService + AuthMiddleware
components.
"""

import pytest

from architect.channels import ChannelRegistry
from architect.decompose_patterns import PatternComponentExtractor
from architect.decomposer import parse_spec, run_decompose_programmatic
from architect.intake import IntakeEngine
from architect.spec_generator import SpecGenerator


# A realistic PoC that has nothing to do with authentication.
NON_AUTH_POC_CONTENT = [
    ("purpose", "objective", 0.8, "Objective: weather dashboard demo"),
    ("purpose", "users", 0.8, "Users: internal demo audience"),
    ("purpose", "scope", 0.8, "Scope: current conditions + 3-day forecast"),
    ("tech_stack", "language", 0.8, "Language: Python 3.12"),
    ("tech_stack", "framework", 0.8, "Framework: FastAPI"),
    ("tech_stack", "database", 0.8, "Database: SQLite"),
    ("tech_stack", "cache", 0.8, "Cache: none"),
    ("tech_stack", "message_queue", 0.8, "Message queue: not needed"),
    ("data_model", "entities", 0.8, "Entities: Forecast, Location"),
    ("data_model", "constraints", 0.8, "Constraint: location name UNIQUE"),
    ("data_model", "relationships", 0.8, "Relationship: Forecast belongs-to Location"),
    ("data_model", "cardinality", 0.8, "Cardinality: Location has-many Forecast"),
    ("data_model", "indexes", 0.8, "Index: location_id"),
]

POC_CRITICAL_CHANNELS = {"purpose", "tech_stack", "data_model"}
POC_THRESHOLD = 0.6
POC_QUALITY_WEIGHT = 0.7


def _poc_engine(with_content: bool = False) -> IntakeEngine:
    """IntakeEngine configured exactly as webapp.py's /api/phase does for PoC."""
    engine = IntakeEngine(ChannelRegistry())
    engine.threshold = POC_THRESHOLD
    engine.set_critical_channels(POC_CRITICAL_CHANNELS)
    engine.set_quality_weight(POC_QUALITY_WEIGHT)
    engine.auto_resolve_poc_defaults()
    if with_content:
        for args in NON_AUTH_POC_CONTENT:
            engine.registry.update_resolution(*args)
    return engine


def _component_ids(plan) -> list[str]:
    return [c.id for wave in plan.waves for c in wave.components]


def _component_names(plan) -> list[str]:
    return [c.name for wave in plan.waves for c in wave.components]


class TestPocDefaultsDoNotSeedAuth:
    def test_auth_channel_stays_completely_unresolved(self):
        engine = _poc_engine()
        auth = engine.registry.get("auth")
        assert auth.resolution == 0.0
        for sub_id, sub in auth.sub_dimensions.items():
            assert sub.resolution == 0.0, f"auth.{sub_id} was auto-seeded"
            assert sub.constraints == [], f"auth.{sub_id} got a constraint"

    def test_the_six_non_auth_defaults_are_still_seeded(self):
        """Guard against over-deletion: only the auth entries were removed."""
        reg = _poc_engine().registry
        expected = {
            ("data_model", "cardinality"): (0.8, "PoC scope — cardinality deferred to MVP"),
            ("data_model", "relationships"): (0.7, "PoC scope — basic relationships, normalize at MVP"),
            ("data_model", "indexes"): (0.8, "PoC scope — default indexes only, optimize at MVP"),
            ("purpose", "success_criteria"): (0.8, "PoC scope — success = working demo, formal metrics at MVP"),
            ("api", "versioning"): (0.9, "PoC scope — no versioning needed"),
            ("api", "realtime"): (0.7, "PoC scope — defer real-time to MVP unless core to concept"),
        }
        for (ch_id, sub_id), (resolution, constraint) in expected.items():
            sub = reg.get(ch_id).sub_dimensions[sub_id]
            assert sub.resolution == resolution, f"{ch_id}.{sub_id} resolution changed"
            assert constraint in sub.constraints, f"{ch_id}.{sub_id} constraint changed"

    def test_unresolved_auth_does_not_block_poc_completion(self):
        engine = _poc_engine()
        for ch_id in POC_CRITICAL_CHANNELS:
            for sub_id in engine.registry.get(ch_id).sub_dimensions:
                engine.registry.update_resolution(ch_id, sub_id, 0.8, f"{ch_id}.{sub_id}: specified")
        assert engine.registry.get("auth").resolution == 0.0
        assert engine.is_complete() is True


class TestPocSpecHasNoPhantomAuth:
    def test_no_auth_section_when_auth_never_discussed(self):
        spec = SpecGenerator(_poc_engine(with_content=True).registry).generate()
        assert "## Auth" not in spec
        assert "MFA" not in spec
        assert "Multi-factor" not in spec
        assert "auth" not in parse_spec(spec)

    def test_zero_input_poc_spec_has_no_auth_section(self):
        """The exact live-diagnostic case: phase set to poc, zero messages sent."""
        spec = SpecGenerator(_poc_engine().registry).generate()
        assert "## Auth" not in spec
        assert "MFA" not in spec


class TestPocDecomposeHasNoPhantomAuthComponents:
    def test_pattern_extractor_finds_no_auth_components(self):
        spec = SpecGenerator(_poc_engine(with_content=True).registry).generate()
        components, _ = PatternComponentExtractor().extract(parse_spec(spec))
        ids = [c.id for c in components]
        assert ids, "expected non-auth components to be extracted"
        assert not [i for i in ids if "auth" in i.lower()], f"phantom auth components: {ids}"

    def test_poc_wave_plan_has_no_auth_components(self):
        engine = _poc_engine(with_content=True)
        spec = SpecGenerator(engine.registry).generate()
        plan = run_decompose_programmatic(spec, engine.registry, phase="poc")
        assert plan.metrics.total_components > 0
        assert not [i for i in _component_ids(plan) if "auth" in i.lower()]
        assert not [n for n in _component_names(plan) if "Auth" in n]

    def test_zero_input_poc_yields_no_components_at_all(self):
        """Previously produced exactly ['auth-service', 'auth-middleware']."""
        engine = _poc_engine()
        spec = SpecGenerator(engine.registry).generate()
        plan = run_decompose_programmatic(spec, engine.registry, phase="poc")
        assert _component_ids(plan) == []
        assert plan.metrics.total_components == 0


class TestPocAppThatWantsAuthStillGetsIt:
    """The fix must not make auth impossible in a PoC-phase app."""

    def _engine_with_auth(self) -> IntakeEngine:
        engine = _poc_engine(with_content=True)
        engine.registry.update_resolution("auth", "method", 0.8, "Auth: JWT bearer tokens")
        engine.registry.update_resolution("auth", "authorization", 0.8, "Authorization: RBAC (admin, viewer)")
        return engine

    def test_auth_section_present_in_spec(self):
        spec = SpecGenerator(self._engine_with_auth().registry).generate()
        assert "## Auth" in spec
        assert "JWT bearer tokens" in spec
        assert "RBAC (admin, viewer)" in spec
        assert "auth" in parse_spec(spec)

    def test_pattern_extractor_still_builds_auth_components(self):
        spec = SpecGenerator(self._engine_with_auth().registry).generate()
        components, _ = PatternComponentExtractor().extract(parse_spec(spec))
        ids = [c.id for c in components]
        assert "auth-service" in ids
        assert "auth-middleware" in ids

    def test_mvp_wave_plan_includes_auth_components(self):
        engine = self._engine_with_auth()
        spec = SpecGenerator(engine.registry).generate()
        plan = run_decompose_programmatic(spec, engine.registry, phase="mvp")
        ids = _component_ids(plan)
        assert "auth-service" in ids
        assert "auth-middleware" in ids
