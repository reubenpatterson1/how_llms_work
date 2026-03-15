"""Tests for channel registry and dimension tracking."""

import pytest
from architect.channels import Channel, SubDimension, ChannelRegistry


class TestSubDimension:
    def test_initial_resolution_zero(self):
        sd = SubDimension(name="test", description="test sub")
        assert sd.resolution == 0.0
        assert sd.constraints == []

    def test_update_resolution(self):
        sd = SubDimension(name="test", description="test sub")
        sd.update(0.7, "Constraint: PostgreSQL")
        assert sd.resolution == 0.7
        assert "Constraint: PostgreSQL" in sd.constraints

    def test_update_clamps_to_one(self):
        sd = SubDimension(name="test", description="test sub")
        sd.update(1.5)
        assert sd.resolution == 1.0

    def test_update_clamps_to_zero(self):
        sd = SubDimension(name="test", description="test sub")
        sd.update(-0.5)
        assert sd.resolution == 0.0

    def test_no_duplicate_constraints(self):
        sd = SubDimension(name="test", description="test sub")
        sd.update(0.5, "same")
        sd.update(0.7, "same")
        assert sd.constraints.count("same") == 1

    def test_to_dict(self):
        sd = SubDimension(name="test", description="desc")
        sd.update(0.8, "c1")
        d = sd.to_dict()
        assert d["name"] == "test"
        assert d["resolution"] == 0.8
        assert "c1" in d["constraints"]


class TestChannel:
    def test_resolution_average(self):
        ch = Channel(id="test", name="Test", description="test")
        ch.sub_dimensions["a"] = SubDimension(name="a", description="a", resolution=0.5)
        ch.sub_dimensions["b"] = SubDimension(name="b", description="b", resolution=1.0)
        assert ch.resolution == pytest.approx(0.75)

    def test_empty_resolution(self):
        ch = Channel(id="test", name="Test", description="test")
        assert ch.resolution == 0.0

    def test_constraints_aggregated(self):
        ch = Channel(id="test", name="Test", description="test")
        ch.sub_dimensions["a"] = SubDimension(name="a", description="a", constraints=["c1"])
        ch.sub_dimensions["b"] = SubDimension(name="b", description="b", constraints=["c2", "c3"])
        assert len(ch.constraints) == 3

    def test_get_unresolved(self):
        ch = Channel(id="test", name="Test", description="test")
        ch.sub_dimensions["a"] = SubDimension(name="a", description="a", resolution=0.9)
        ch.sub_dimensions["b"] = SubDimension(name="b", description="b", resolution=0.3)
        unresolved = ch.get_unresolved(0.8)
        assert len(unresolved) == 1
        assert unresolved[0].name == "b"

    def test_to_dict(self):
        ch = Channel(id="test", name="Test", description="test")
        ch.sub_dimensions["a"] = SubDimension(name="a", description="a")
        d = ch.to_dict()
        assert d["id"] == "test"
        assert "a" in d["sub_dimensions"]


class TestChannelRegistry:
    def test_init_has_10_channels(self):
        reg = ChannelRegistry()
        assert len(reg.channels) == 10

    def test_channel_ids(self):
        reg = ChannelRegistry()
        expected = {"purpose", "data_model", "api", "tech_stack", "auth",
                    "deployment", "error_handling", "performance", "security", "testing"}
        assert set(reg.channels.keys()) == expected

    def test_all_channels_have_sub_dimensions(self):
        reg = ChannelRegistry()
        for ch in reg.channels.values():
            assert len(ch.sub_dimensions) >= 4

    def test_initial_density_zero(self):
        reg = ChannelRegistry()
        assert reg.overall_density_score() == 0.0

    def test_update_resolution(self):
        reg = ChannelRegistry()
        reg.update_resolution("tech_stack", "database", 0.9, "PostgreSQL")
        ch = reg.get("tech_stack")
        assert ch.sub_dimensions["database"].resolution == 0.9

    def test_update_nonexistent_channel(self):
        reg = ChannelRegistry()
        reg.update_resolution("nonexistent", "sub", 0.5)  # Should not raise

    def test_get_unresolved(self):
        reg = ChannelRegistry()
        unresolved = reg.get_unresolved(0.8)
        assert len(unresolved) == 10  # All channels start at 0

    def test_snapshot(self):
        reg = ChannelRegistry()
        snap = reg.snapshot()
        assert "density_score" in snap
        assert "channels" in snap
        assert len(snap["channels"]) == 10

    def test_density_increases(self):
        reg = ChannelRegistry()
        assert reg.overall_density_score() == 0.0
        for sub_id in reg.channels["tech_stack"].sub_dimensions:
            reg.update_resolution("tech_stack", sub_id, 1.0, f"constraint_{sub_id}")
        assert reg.overall_density_score() > 0.0
