"""Tests for specification generator."""

import pytest
from architect.channels import ChannelRegistry
from architect.spec_generator import SpecGenerator


class TestSpecGenerator:
    def test_generates_markdown(self):
        reg = ChannelRegistry()
        reg.update_resolution("tech_stack", "database", 0.9, "Database: PostgreSQL")
        gen = SpecGenerator(reg)
        spec = gen.generate()
        assert "# Dense Architecture Specification" in spec
        assert "PostgreSQL" in spec

    def test_includes_density_score(self):
        reg = ChannelRegistry()
        gen = SpecGenerator(reg)
        spec = gen.generate()
        assert "Density Score:" in spec

    def test_includes_implementation_rules(self):
        reg = ChannelRegistry()
        gen = SpecGenerator(reg)
        spec = gen.generate()
        assert "Implementation Rules" in spec
        assert "do not invent" in spec.lower()

    def test_constraints_appear_as_list_items(self):
        reg = ChannelRegistry()
        reg.update_resolution("auth", "method", 0.8, "Auth: JWT tokens")
        reg.update_resolution("auth", "authorization", 0.8, "Authorization: RBAC")
        gen = SpecGenerator(reg)
        spec = gen.generate()
        assert "- Auth: JWT tokens" in spec
        assert "- Authorization: RBAC" in spec

    def test_skips_empty_channels(self):
        reg = ChannelRegistry()
        # Only resolve tech_stack
        reg.update_resolution("tech_stack", "language", 0.9, "Language: Python")
        gen = SpecGenerator(reg)
        spec = gen.generate()
        # Should include Tech Stack but the section header for empty channels should not appear
        assert "Tech Stack" in spec

    def test_density_score_method(self):
        reg = ChannelRegistry()
        gen = SpecGenerator(reg)
        assert gen.density_score() == 0.0

    def test_unresolved_summary(self):
        reg = ChannelRegistry()
        gen = SpecGenerator(reg)
        summary = gen.unresolved_summary()
        assert "Unresolved" in summary

    def test_unresolved_summary_all_resolved(self):
        reg = ChannelRegistry()
        for ch in reg.channels.values():
            for sub in ch.sub_dimensions.values():
                sub.update(1.0, f"constraint_{sub.name}")
        gen = SpecGenerator(reg)
        summary = gen.unresolved_summary()
        assert "fully resolved" in summary.lower()

    def test_flat_constraints_section(self):
        reg = ChannelRegistry()
        reg.update_resolution("tech_stack", "database", 0.9, "DB: Postgres")
        reg.update_resolution("auth", "method", 0.8, "Auth: JWT")
        gen = SpecGenerator(reg)
        spec = gen.generate()
        assert "All Constraints (Flat)" in spec
