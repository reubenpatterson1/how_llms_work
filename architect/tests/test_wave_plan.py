"""Unit tests for wave_plan.py data structures."""

import pytest
from architect.wave_plan import (
    Component,
    DependencyEdge,
    InterfaceContract,
    Wave,
    WavePlan,
    WavePlanMetrics,
)


class TestComponent:
    def test_to_dict(self):
        c = Component(
            id="user-model",
            name="UserModel",
            description="User entity",
            component_type="model",
            channel_sources=["data_model"],
            constraints=["Entity: User"],
            dependencies=[],
            interfaces_provided=["IUserRepository"],
            interfaces_consumed=[],
            estimated_complexity="low",
        )
        d = c.to_dict()
        assert d["id"] == "user-model"
        assert d["component_type"] == "model"
        assert d["interfaces_provided"] == ["IUserRepository"]
        assert d["estimated_complexity"] == "low"

    def test_default_fields(self):
        c = Component(id="x", name="X", description="", component_type="config")
        assert c.channel_sources == []
        assert c.dependencies == []
        assert c.estimated_complexity == "medium"


class TestWave:
    def test_parallel_count(self):
        comps = [
            Component(id="a", name="A", description="", component_type="model", estimated_complexity="low"),
            Component(id="b", name="B", description="", component_type="model", estimated_complexity="high"),
        ]
        w = Wave(number=1, label="Test Wave", components=comps)
        assert w.parallel_count == 2

    def test_time_estimates(self):
        comps = [
            Component(id="a", name="A", description="", component_type="model", estimated_complexity="low"),
            Component(id="b", name="B", description="", component_type="model", estimated_complexity="high"),
        ]
        w = Wave(number=1, label="Test Wave", components=comps)
        assert w.estimated_time_sequential == 40.0  # 10 + 30
        assert w.estimated_time_parallel == 30.0      # max(10, 30)

    def test_empty_wave(self):
        w = Wave(number=0, label="Empty")
        assert w.parallel_count == 0
        assert w.estimated_time_sequential == 0.0
        assert w.estimated_time_parallel == 0.0


class TestWavePlanMetrics:
    def test_to_dict_rounds(self):
        m = WavePlanMetrics(
            total_components=10,
            total_waves=3,
            max_parallelism=4,
            dependency_depth=3,
            parallelism_ratio=0.33333,
            estimated_sequential_minutes=100.123,
            estimated_parallel_minutes=60.456,
            time_savings_percent=39.567,
            components_per_wave=[4, 3, 3],
        )
        d = m.to_dict()
        assert d["parallelism_ratio"] == 0.333
        assert d["estimated_sequential_minutes"] == 100.1
        assert d["time_savings_percent"] == 39.6


class TestInterfaceContract:
    def test_to_dict(self):
        i = InterfaceContract(
            name="IUserRepository",
            component_name="UserModel",
            methods=["create(user: CreateUserDTO) -> User"],
            data_types=["CreateUserDTO", "User"],
            channel_sources=["data_model"],
        )
        d = i.to_dict()
        assert d["name"] == "IUserRepository"
        assert len(d["methods"]) == 1


class TestDependencyEdge:
    def test_to_dict(self):
        e = DependencyEdge(from_component="handler", to_component="service", reason="data ops")
        d = e.to_dict()
        assert d["from_component"] == "handler"
        assert d["to_component"] == "service"


class TestWavePlan:
    def test_to_markdown_contains_key_sections(self):
        plan = WavePlan(
            waves=[
                Wave(number=0, label="Interfaces", components=[
                    Component(id="x", name="X", description="test", component_type="interface",
                              channel_sources=["api"]),
                ]),
                Wave(number=1, label="Foundation", components=[
                    Component(id="y", name="Y", description="model", component_type="model",
                              channel_sources=["data_model"]),
                ]),
            ],
            interfaces=[
                InterfaceContract(name="IX", component_name="X", methods=["do()"], channel_sources=["api"]),
            ],
            dependency_graph=[
                DependencyEdge(from_component="y", to_component="x", reason="depends"),
            ],
            phase="mvp",
            metrics=WavePlanMetrics(
                total_components=2, total_waves=2, max_parallelism=1,
                dependency_depth=2, parallelism_ratio=0.5,
                estimated_sequential_minutes=40.0, estimated_parallel_minutes=20.0,
                time_savings_percent=50.0, components_per_wave=[1, 1],
            ),
        )
        md = plan.to_markdown()
        assert "Wave Plan" in md
        assert "MVP" in md
        assert "Wave 0: Interfaces" in md
        assert "Wave 1: Foundation" in md
        assert "Interface Contracts" in md
        assert "Dependency Graph" in md
        assert "y -> x" in md

    def test_to_dict_roundtrip(self):
        plan = WavePlan(phase="poc")
        d = plan.to_dict()
        assert d["phase"] == "poc"
        assert d["waves"] == []
        assert d["metrics"]["total_components"] == 0
