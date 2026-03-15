"""Tests for comparative analysis engine."""

import json
import os
import tempfile

import pytest
from architect.comparator import Comparator
from architect.mock_llm import MockLLM


class TestComparator:
    def test_run_produces_results(self):
        comp = Comparator(iterations=3)
        results = comp.run()
        assert "vague" in results
        assert "dense" in results
        assert "deltas" in results

    def test_vague_has_higher_hallucination(self):
        comp = Comparator(iterations=5)
        results = comp.run()
        assert results["vague"]["metrics"]["hallucination_surface"] > \
               results["dense"]["metrics"]["hallucination_surface"]

    def test_dense_has_higher_consistency(self):
        comp = Comparator(iterations=5)
        results = comp.run()
        assert results["dense"]["metrics"]["consistency"] >= \
               results["vague"]["metrics"]["consistency"]

    def test_dense_has_higher_dimension_resolution(self):
        comp = Comparator(iterations=5)
        results = comp.run()
        assert results["dense"]["metrics"]["dimension_resolution"] > \
               results["vague"]["metrics"]["dimension_resolution"]

    def test_dense_has_higher_code_quality(self):
        comp = Comparator(iterations=5)
        results = comp.run()
        assert results["dense"]["metrics"]["code_quality"] >= \
               results["vague"]["metrics"]["code_quality"]

    def test_deltas_positive(self):
        comp = Comparator(iterations=5)
        results = comp.run()
        assert results["deltas"]["hallucination_reduction"] > 0
        assert results["deltas"]["consistency_improvement"] >= 0
        assert results["deltas"]["resolution_improvement"] > 0

    def test_correct_number_of_outputs(self):
        comp = Comparator(iterations=3)
        results = comp.run()
        assert len(results["vague"]["outputs"]) == 3
        assert len(results["dense"]["outputs"]) == 3

    def test_output_has_token_traces(self):
        comp = Comparator(iterations=1)
        results = comp.run()
        vague_out = results["vague"]["outputs"][0]
        assert "tokens" in vague_out
        assert len(vague_out["tokens"]) > 0
        assert "grounding" in vague_out["tokens"][0]

    def test_export_json(self):
        comp = Comparator(iterations=2)
        comp.run()
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            path = f.name
        try:
            comp.export_json(path)
            with open(path) as f:
                data = json.load(f)
            assert "vague" in data
            assert "dense" in data
        finally:
            os.unlink(path)

    def test_vague_outputs_vary(self):
        comp = Comparator(iterations=5)
        comp.run()
        # Different vague outputs should have different raw text
        texts = {o.raw_text for o in comp.vague_outputs}
        assert len(texts) > 1, "Vague outputs should vary across runs"

    def test_dense_outputs_consistent(self):
        comp = Comparator(iterations=5)
        comp.run()
        texts = {o.raw_text for o in comp.dense_outputs}
        assert len(texts) == 1, "Dense outputs should be identical across runs"

    def test_grounding_breakdown_present(self):
        comp = Comparator(iterations=1)
        results = comp.run()
        breakdown = results["vague"]["outputs"][0]["grounding_breakdown"]
        assert "grounded" in breakdown
        assert "confabulated" in breakdown
