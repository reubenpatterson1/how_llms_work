"""Tests for response analyzer pattern matching and ambiguity detection."""

import pytest
from architect.analyzer import ResponseAnalyzer


class TestPatternMatching:
    def setup_method(self):
        self.analyzer = ResponseAnalyzer()

    def test_detects_postgresql(self):
        updates = self.analyzer.analyze("We'll use PostgreSQL for the database")
        channels = {u.channel_id for u in updates}
        assert "tech_stack" in channels
        db_update = next(u for u in updates if u.sub_dimension == "database")
        assert db_update.resolution >= 0.8

    def test_detects_jwt_auth(self):
        updates = self.analyzer.analyze("Authentication will use JWT tokens")
        auth_updates = [u for u in updates if u.channel_id == "auth"]
        assert len(auth_updates) >= 1

    def test_detects_multiple_dimensions(self):
        text = "We'll use Python with FastAPI, PostgreSQL for storage, and Redis for caching"
        updates = self.analyzer.analyze(text)
        channels = {(u.channel_id, u.sub_dimension) for u in updates}
        assert ("tech_stack", "language") in channels
        assert ("tech_stack", "framework") in channels
        assert ("tech_stack", "database") in channels
        assert ("tech_stack", "cache") in channels

    def test_detects_kubernetes(self):
        updates = self.analyzer.analyze("Deploy on Kubernetes with auto-scaling")
        channels = {u.channel_id for u in updates}
        assert "deployment" in channels

    def test_detects_rest_api(self):
        updates = self.analyzer.analyze("RESTful API with WebSocket for real-time")
        subs = {u.sub_dimension for u in updates if u.channel_id == "api"}
        assert "endpoints" in subs
        assert "realtime" in subs

    def test_detects_rbac(self):
        updates = self.analyzer.analyze("RBAC with admin and member roles")
        auth_updates = [u for u in updates if u.channel_id == "auth"]
        assert any(u.sub_dimension == "authorization" for u in auth_updates)

    def test_no_false_positives_on_plain_text(self):
        updates = self.analyzer.analyze("The weather is nice today")
        assert len(updates) == 0

    def test_case_insensitive(self):
        updates = self.analyzer.analyze("we use POSTGRESQL and REDIS")
        assert len(updates) >= 2

    def test_constraint_text_included(self):
        updates = self.analyzer.analyze("Database: PostgreSQL")
        db = next(u for u in updates if u.sub_dimension == "database")
        assert "PostgreSQL" in db.constraint

    def test_detects_cors(self):
        updates = self.analyzer.analyze("CORS policy for frontend origin")
        assert any(u.channel_id == "security" for u in updates)

    def test_detects_rate_limiting(self):
        updates = self.analyzer.analyze("Rate limiting at 100 req/min")
        sec_updates = [u for u in updates if u.channel_id == "security"]
        assert any(u.sub_dimension == "rate_limiting" for u in sec_updates)

    def test_detects_cursor_pagination(self):
        updates = self.analyzer.analyze("Use cursor-based pagination")
        assert any(u.sub_dimension == "pagination" for u in updates)


class TestAmbiguityDetection:
    def setup_method(self):
        self.analyzer = ResponseAnalyzer()

    def test_detects_some_kind_of(self):
        ambiguities = self.analyzer.identify_ambiguities("Some kind of database")
        assert len(ambiguities) >= 1

    def test_detects_maybe(self):
        ambiguities = self.analyzer.identify_ambiguities("Maybe we'll use Redis")
        assert len(ambiguities) >= 1

    def test_detects_simple(self):
        ambiguities = self.analyzer.identify_ambiguities("Just a simple API")
        assert len(ambiguities) >= 1

    def test_detects_etc(self):
        ambiguities = self.analyzer.identify_ambiguities("Users, tasks, etc.")
        assert len(ambiguities) >= 1

    def test_detects_dont_care(self):
        ambiguities = self.analyzer.identify_ambiguities("I don't care about the database")
        assert len(ambiguities) >= 1
        assert "hallucination" in ambiguities[0].reason.lower() or "unspecified" in ambiguities[0].reason.lower()

    def test_detects_figure_out_later(self):
        ambiguities = self.analyzer.identify_ambiguities("We'll figure it out later")
        assert len(ambiguities) >= 1

    def test_no_ambiguity_in_precise_text(self):
        ambiguities = self.analyzer.identify_ambiguities(
            "PostgreSQL 15, Python 3.12, FastAPI 0.104, JWT with RS256")
        assert len(ambiguities) == 0

    def test_reason_is_actionable(self):
        ambiguities = self.analyzer.identify_ambiguities("some kind of auth")
        assert len(ambiguities) >= 1
        assert len(ambiguities[0].reason) > 10  # Reason should be descriptive
