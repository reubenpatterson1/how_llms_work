"""Data structures for the Decomposition Agent's wave plan output.

Defines single-function components, dependency edges, interface contracts,
waves (groups of parallelizable components), and the full WavePlan with metrics.
"""

from dataclasses import dataclass, field


@dataclass
class InterfaceContract:
    """Defines the boundary between components — Wave 0 output."""

    name: str                       # e.g., "ITaskRepository"
    component_name: str             # which component owns this interface
    methods: list[str] = field(default_factory=list)     # method signatures
    data_types: list[str] = field(default_factory=list)  # DTOs/types exposed
    channel_sources: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "component_name": self.component_name,
            "methods": list(self.methods),
            "data_types": list(self.data_types),
            "channel_sources": list(self.channel_sources),
        }


@dataclass
class Component:
    """A single-function unit of implementation — one confabulation firewall."""

    id: str                         # kebab-case: "user-model"
    name: str                       # display: "UserModel"
    description: str
    component_type: str             # "model"|"service"|"middleware"|"handler"|"config"|"interface"|"test"
    channel_sources: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)       # component IDs
    interfaces_provided: list[str] = field(default_factory=list)
    interfaces_consumed: list[str] = field(default_factory=list)
    estimated_complexity: str = "medium"  # "low"|"medium"|"high"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "component_type": self.component_type,
            "channel_sources": list(self.channel_sources),
            "constraints": list(self.constraints),
            "dependencies": list(self.dependencies),
            "interfaces_provided": list(self.interfaces_provided),
            "interfaces_consumed": list(self.interfaces_consumed),
            "estimated_complexity": self.estimated_complexity,
        }


@dataclass
class DependencyEdge:
    """An edge in the component dependency graph."""

    from_component: str   # component ID (depends on to_component)
    to_component: str     # component ID
    reason: str

    def to_dict(self) -> dict:
        return {
            "from_component": self.from_component,
            "to_component": self.to_component,
            "reason": self.reason,
        }


COMPLEXITY_MINUTES = {"low": 10.0, "medium": 20.0, "high": 30.0}


@dataclass
class Wave:
    """A group of components that can execute in parallel."""

    number: int
    label: str
    components: list[Component] = field(default_factory=list)

    @property
    def parallel_count(self) -> int:
        return len(self.components)

    @property
    def estimated_time_sequential(self) -> float:
        return sum(COMPLEXITY_MINUTES.get(c.estimated_complexity, 20.0) for c in self.components)

    @property
    def estimated_time_parallel(self) -> float:
        if not self.components:
            return 0.0
        return max(COMPLEXITY_MINUTES.get(c.estimated_complexity, 20.0) for c in self.components)

    def to_dict(self) -> dict:
        return {
            "number": self.number,
            "label": self.label,
            "components": [c.to_dict() for c in self.components],
            "parallel_count": self.parallel_count,
            "estimated_time_sequential": self.estimated_time_sequential,
            "estimated_time_parallel": self.estimated_time_parallel,
        }


@dataclass
class WavePlanMetrics:
    """Monitoring data for the wave plan."""

    total_components: int
    total_waves: int
    max_parallelism: int
    dependency_depth: int
    parallelism_ratio: float
    estimated_sequential_minutes: float
    estimated_parallel_minutes: float
    time_savings_percent: float
    components_per_wave: list[int] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_components": self.total_components,
            "total_waves": self.total_waves,
            "max_parallelism": self.max_parallelism,
            "dependency_depth": self.dependency_depth,
            "parallelism_ratio": round(self.parallelism_ratio, 3),
            "estimated_sequential_minutes": round(self.estimated_sequential_minutes, 1),
            "estimated_parallel_minutes": round(self.estimated_parallel_minutes, 1),
            "time_savings_percent": round(self.time_savings_percent, 1),
            "components_per_wave": list(self.components_per_wave),
        }


@dataclass
class WavePlan:
    """Full output of the Decomposition Agent."""

    waves: list[Wave] = field(default_factory=list)
    interfaces: list[InterfaceContract] = field(default_factory=list)
    dependency_graph: list[DependencyEdge] = field(default_factory=list)
    phase: str = "mvp"
    metrics: WavePlanMetrics = field(default_factory=lambda: WavePlanMetrics(
        total_components=0, total_waves=0, max_parallelism=0,
        dependency_depth=0, parallelism_ratio=0.0,
        estimated_sequential_minutes=0.0, estimated_parallel_minutes=0.0,
        time_savings_percent=0.0,
    ))

    def to_dict(self) -> dict:
        return {
            "waves": [w.to_dict() for w in self.waves],
            "interfaces": [i.to_dict() for i in self.interfaces],
            "dependency_graph": [e.to_dict() for e in self.dependency_graph],
            "phase": self.phase,
            "metrics": self.metrics.to_dict(),
        }

    def to_markdown(self) -> str:
        lines = [
            "# Wave Plan",
            f"# Phase: {self.phase.upper()} | Components: {self.metrics.total_components} "
            f"| Waves: {self.metrics.total_waves} | Parallelism: {self.metrics.max_parallelism}x "
            f"| Time Savings: {self.metrics.time_savings_percent:.0f}%",
            "",
        ]

        for wave in self.waves:
            dep_str = ""
            if wave.number > 0:
                dep_str = f" | Dependencies: Wave {wave.number - 1}"
            lines.append(f"## Wave {wave.number}: {wave.label}")
            lines.append(f"# Components: {wave.parallel_count} | Parallel: {wave.parallel_count}{dep_str}")
            for comp in wave.components:
                channels = ", ".join(comp.channel_sources)
                lines.append(f"- {comp.name} [{channels}] — {comp.description}")
            lines.append("")

        if self.interfaces:
            lines.append("## Interface Contracts")
            for iface in self.interfaces:
                methods = ", ".join(iface.methods) if iface.methods else "TBD"
                lines.append(f"- {iface.name}: {methods}")
            lines.append("")

        if self.dependency_graph:
            lines.append("## Dependency Graph")
            for edge in self.dependency_graph:
                lines.append(f"- {edge.from_component} -> {edge.to_component} ({edge.reason})")
            lines.append("")

        return "\n".join(lines)

    def to_build_package(self, dense_spec: str) -> str:
        """Generate a complete build package: dense spec + wave plan + per-component prompts.

        This is the exportable artifact a developer takes to another LLM session
        to execute the build in wave order.
        """
        sections = []

        # Header
        sections.append(f"# Build Package — {self.phase.upper()}")
        sections.append(f"# Generated by Architecture Agent → Decomposition Agent")
        sections.append(f"# {self.metrics.total_components} components · "
                        f"{self.metrics.total_waves} waves · "
                        f"{self.metrics.max_parallelism}× parallelism · "
                        f"{self.metrics.time_savings_percent:.0f}% time savings")
        sections.append("")

        # Part 1: Dense Specification
        sections.append("---")
        sections.append("## Part 1: Dense Architecture Specification")
        sections.append("")
        sections.append(dense_spec.strip())
        sections.append("")

        # Part 2: Wave Plan
        sections.append("---")
        sections.append("## Part 2: Wave Plan")
        sections.append("")
        sections.append(self.to_markdown())

        # Part 3: Interface Contracts (detailed)
        if self.interfaces:
            sections.append("---")
            sections.append("## Part 3: Interface Contracts")
            sections.append("")
            sections.append("Build these interfaces FIRST (Wave 0). "
                            "All components depend on these type definitions.")
            sections.append("")
            for iface in self.interfaces:
                sections.append(f"### {iface.name}")
                sections.append(f"Owner: {iface.component_name}")
                if iface.data_types:
                    sections.append(f"Types: {', '.join(iface.data_types)}")
                sections.append("```")
                for method in iface.methods:
                    sections.append(f"  {method}")
                sections.append("```")
                sections.append("")

        # Part 4: Per-Component Build Prompts
        sections.append("---")
        sections.append("## Part 4: Component Build Prompts")
        sections.append("")
        sections.append("Execute these prompts in wave order. "
                        "Components within the same wave can be built in parallel.")
        sections.append("")

        for wave in self.waves:
            sections.append(f"### Wave {wave.number}: {wave.label}")
            sections.append("")
            for comp in wave.components:
                sections.append(f"#### {comp.name}")
                sections.append("")

                # Build the prompt
                prompt_lines = [
                    f"Build a {comp.component_type} component named `{comp.name}`.",
                    f"Purpose: {comp.description}.",
                ]

                if comp.constraints:
                    prompt_lines.append("")
                    prompt_lines.append("Constraints from the architecture spec:")
                    for c in comp.constraints:
                        prompt_lines.append(f"- {c}")

                if comp.interfaces_provided:
                    prompt_lines.append("")
                    prompt_lines.append(f"Must implement: {', '.join(comp.interfaces_provided)}")
                    # Find the interface contract
                    for iface in self.interfaces:
                        if iface.name in comp.interfaces_provided:
                            prompt_lines.append(f"Methods for {iface.name}:")
                            for m in iface.methods:
                                prompt_lines.append(f"  - {m}")

                if comp.interfaces_consumed:
                    prompt_lines.append("")
                    prompt_lines.append(f"Depends on (import, do not implement): "
                                        f"{', '.join(comp.interfaces_consumed)}")

                if comp.dependencies:
                    prompt_lines.append("")
                    prompt_lines.append(f"Dependencies: {', '.join(comp.dependencies)}")

                sections.append("```text")
                sections.append("\n".join(prompt_lines))
                sections.append("```")
                sections.append("")

        # Part 5: Dependency Graph
        if self.dependency_graph:
            sections.append("---")
            sections.append("## Part 5: Dependency Graph")
            sections.append("")
            sections.append("```")
            for edge in self.dependency_graph:
                sections.append(f"{edge.from_component} → {edge.to_component}  ({edge.reason})")
            sections.append("```")
            sections.append("")

        return "\n".join(sections)
