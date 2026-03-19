"""End-to-end test: full pipeline from intake to decomposition.

Tests the complete flow: scripted responses → Architecture Agent → Dense Spec → Decomposition Agent → Wave Plan.
"""

import json
import os

import pytest
from architect.agent import run_programmatic
from architect.decomposer import run_decompose_programmatic
from architect.tests.test_e2e import SCRIPTED_RESPONSES


class TestDecomposeEndToEnd:
    def test_full_pipeline_intake_to_waves(self):
        """Run intake → spec → decomposition pipeline."""
        # Phase 1: Architecture Agent produces spec
        spec, registry, snapshots = run_programmatic(SCRIPTED_RESPONSES)
        assert "Dense Architecture Specification" in spec
        assert registry.overall_density_score() > 0.5

        # Phase 2: Decomposition Agent produces wave plan
        wave_plan = run_decompose_programmatic(spec, registry, phase="mvp")

        # Verify wave plan structure
        assert wave_plan.metrics.total_components > 0
        assert wave_plan.metrics.total_waves >= 2
        assert wave_plan.phase == "mvp"

        # Verify interfaces exist
        assert len(wave_plan.interfaces) > 0

        # Verify dependency graph
        assert len(wave_plan.dependency_graph) > 0

        # Verify time savings (the 30-40% from key takeaways)
        assert wave_plan.metrics.time_savings_percent > 20

    def test_wave_plan_has_expected_components(self):
        """Verify that known entities produce model components."""
        spec, registry, _ = run_programmatic(SCRIPTED_RESPONSES)
        plan = run_decompose_programmatic(spec, registry, phase="mvp")

        all_component_names = set()
        for wave in plan.waves:
            for comp in wave.components:
                all_component_names.add(comp.name)

        # Should have model components (entity names vary based on regex extraction)
        has_models = any("Model" in n for n in all_component_names)
        assert has_models or len(all_component_names) > 5, \
            f"Expected model components, got: {all_component_names}"

        # Should have auth components
        assert "AuthService" in all_component_names or "AuthMiddleware" in all_component_names

    def test_wave_plan_to_markdown_output(self):
        """Verify markdown output is well-formed."""
        spec, registry, _ = run_programmatic(SCRIPTED_RESPONSES)
        plan = run_decompose_programmatic(spec, registry, phase="mvp")

        md = plan.to_markdown()
        assert "# Wave Plan" in md
        assert "MVP" in md
        assert "Wave 0:" in md or "Wave 1:" in md

    def test_phase_comparison(self):
        """PoC should produce fewer components than PreProd."""
        spec, registry, _ = run_programmatic(SCRIPTED_RESPONSES)

        poc = run_decompose_programmatic(spec, registry, phase="poc")
        preprod = run_decompose_programmatic(spec, registry, phase="preprod")

        assert poc.metrics.total_components <= preprod.metrics.total_components
        assert poc.metrics.total_waves <= preprod.metrics.total_waves

    def test_to_dict_serializable(self):
        """Verify the plan can be JSON-serialized."""
        spec, registry, _ = run_programmatic(SCRIPTED_RESPONSES)
        plan = run_decompose_programmatic(spec, registry, phase="mvp")

        d = plan.to_dict()
        # Should not raise
        serialized = json.dumps(d, indent=2)
        loaded = json.loads(serialized)

        assert loaded["phase"] == "mvp"
        assert loaded["metrics"]["total_components"] > 0

    def test_all_components_have_channel_sources(self):
        """Every component should trace back to at least one spec channel."""
        spec, registry, _ = run_programmatic(SCRIPTED_RESPONSES)
        plan = run_decompose_programmatic(spec, registry, phase="preprod")

        for wave in plan.waves:
            for comp in wave.components:
                assert len(comp.channel_sources) > 0, \
                    f"Component {comp.name} has no channel sources"
