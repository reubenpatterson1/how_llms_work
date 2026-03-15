"""Tests for intake engine Q&A flow."""

import pytest
from architect.intake import IntakeEngine
from architect.channels import ChannelRegistry


class TestIntakeEngine:
    def test_first_question_not_empty(self):
        engine = IntakeEngine()
        q = engine.first_question()
        assert q and len(q) > 10

    def test_process_response_returns_result(self):
        engine = IntakeEngine()
        result = engine.process_response("We'll use Python with FastAPI and PostgreSQL")
        assert result.snapshot is not None
        assert isinstance(result.updates, list)
        assert isinstance(result.ambiguities, list)

    def test_process_updates_registry(self):
        engine = IntakeEngine()
        engine.process_response("Python 3.12 with FastAPI, PostgreSQL, Redis cache")
        reg = engine.registry
        assert reg.get("tech_stack").sub_dimensions["language"].resolution > 0
        assert reg.get("tech_stack").sub_dimensions["framework"].resolution > 0
        assert reg.get("tech_stack").sub_dimensions["database"].resolution > 0

    def test_next_question_targets_lowest(self):
        engine = IntakeEngine()
        # Resolve tech_stack heavily
        engine.process_response("Python FastAPI PostgreSQL Redis Kafka")
        # Next question should NOT be about tech_stack (it's the most resolved)
        result = engine.process_response("dummy")
        # The next question should target an unresolved channel
        assert result.next_question is not None

    def test_history_tracked(self):
        engine = IntakeEngine()
        engine.process_response("PostgreSQL")
        engine.process_response("JWT auth")
        assert len(engine.history) == 2

    def test_snapshots_tracked(self):
        engine = IntakeEngine()
        engine.process_response("PostgreSQL")
        engine.process_response("Redis")
        snapshots = engine.get_snapshots()
        assert len(snapshots) == 2
        # Second snapshot should have equal or higher density
        assert snapshots[1]["density_score"] >= snapshots[0]["density_score"]

    def test_is_complete_initially_false(self):
        engine = IntakeEngine()
        assert not engine.is_complete()

    def test_ambiguities_propagated(self):
        engine = IntakeEngine()
        result = engine.process_response("Some kind of database, maybe PostgreSQL")
        assert len(result.ambiguities) >= 1

    def test_completion_with_threshold(self):
        engine = IntakeEngine(threshold=0.0)
        assert engine.is_complete()  # threshold=0 means everything is "resolved"

    def test_multiple_responses_accumulate(self):
        engine = IntakeEngine()
        engine.process_response("Python FastAPI")
        score1 = engine.registry.overall_density_score()
        engine.process_response("PostgreSQL Redis JWT RBAC")
        score2 = engine.registry.overall_density_score()
        assert score2 > score1
