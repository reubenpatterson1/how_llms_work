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


def _yaml_escape(s: str) -> str:
    """Escape a string for safe inclusion in double-quoted YAML values."""
    return s.replace("\\", "\\\\").replace('"', '\\"')


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
        """Generate a YAML DAG build package: spec + interfaces + component nodes with edges.

        This is the exportable artifact a developer takes to another LLM session
        to execute the build in dependency order. The DAG structure makes wave
        scheduling and parallel execution explicit and machine-parseable.
        """
        lines: list[str] = []

        # ── Header ──
        lines.append("# Build Package — YAML DAG Format")
        lines.append(f"# Generated by Architecture Agent → Decomposition Agent")
        lines.append("")

        # ── Metadata ──
        lines.append("metadata:")
        lines.append(f"  phase: {self.phase}")
        lines.append(f"  total_components: {self.metrics.total_components}")
        lines.append(f"  total_waves: {self.metrics.total_waves}")
        lines.append(f"  max_parallelism: {self.metrics.max_parallelism}")
        lines.append(f"  time_savings_percent: {self.metrics.time_savings_percent:.0f}")
        lines.append(f"  estimated_sequential_minutes: {self.metrics.estimated_sequential_minutes:.0f}")
        lines.append(f"  estimated_parallel_minutes: {self.metrics.estimated_parallel_minutes:.0f}")
        lines.append("")

        # ── Dense Spec (channel → constraints) ──
        lines.append("spec:")
        spec_lines = dense_spec.strip().split("\n")
        current_channel = None
        for spec_line in spec_lines:
            stripped = spec_line.strip()
            # Channel header: "## Purpose", "## Data Model", etc.
            if stripped.startswith("## ") and not stripped.startswith("## All Constraints") and not stripped.startswith("## Implementation"):
                current_channel = stripped[3:].strip().lower().replace(" ", "_")
                lines.append(f"  {current_channel}:")
            # Skip resolution lines, title, density score, flat constraints, impl rules
            elif stripped.startswith("# ") or stripped == "" or stripped.startswith("## All Constraints") or stripped.startswith("## Implementation"):
                if stripped.startswith("## All Constraints") or stripped.startswith("## Implementation"):
                    current_channel = None
                continue
            elif stripped.startswith("- ") and current_channel:
                lines.append(f"    - \"{_yaml_escape(stripped[2:])}\"")
        lines.append("")

        # ── Implementation Rules ──
        lines.append("rules:")
        lines.append("  - \"Every architectural decision MUST trace to a constraint in spec\"")
        lines.append("  - \"If a dimension has no constraint, ASK — do not invent\"")
        lines.append("  - \"Prefer explicit over implicit in all generated code\"")
        lines.append("  - \"No defaults: every value must come from this spec\"")
        lines.append("")

        # ── Interface Contracts ──
        if self.interfaces:
            lines.append("interfaces:")
            for iface in self.interfaces:
                lines.append(f"  {iface.name}:")
                lines.append(f"    owner: {iface.component_name}")
                if iface.data_types:
                    lines.append(f"    types:")
                    for dt in iface.data_types:
                        lines.append(f"      - {dt}")
                if iface.methods:
                    lines.append(f"    methods:")
                    for m in iface.methods:
                        lines.append(f"      - \"{_yaml_escape(m)}\"")
            lines.append("")

        # ── DAG: component nodes with edges ──
        lines.append("dag:")
        for wave in self.waves:
            for comp in wave.components:
                lines.append(f"  {comp.id}:")
                lines.append(f"    name: {comp.name}")
                lines.append(f"    type: {comp.component_type}")
                lines.append(f"    wave: {wave.number}")
                lines.append(f"    complexity: {comp.estimated_complexity}")

                # Dependency edges
                if comp.dependencies:
                    lines.append(f"    depends_on:")
                    for dep_id in comp.dependencies:
                        # Find the reason from the dependency graph
                        reason = ""
                        for edge in self.dependency_graph:
                            if edge.from_component == comp.id and edge.to_component == dep_id:
                                reason = edge.reason
                                break
                        if reason:
                            lines.append(f"      - id: {dep_id}")
                            lines.append(f"        reason: \"{_yaml_escape(reason)}\"")
                        else:
                            lines.append(f"      - id: {dep_id}")

                # Interface contracts
                if comp.interfaces_provided:
                    lines.append(f"    provides:")
                    for ip in comp.interfaces_provided:
                        lines.append(f"      - {ip}")
                if comp.interfaces_consumed:
                    lines.append(f"    consumes:")
                    for ic in comp.interfaces_consumed:
                        lines.append(f"      - {ic}")

                # Constraints
                if comp.constraints:
                    lines.append(f"    constraints:")
                    for c in comp.constraints:
                        lines.append(f"      - \"{_yaml_escape(c)}\"")

                # Build prompt
                prompt = self._build_component_prompt(comp)
                lines.append(f"    prompt: |")
                for pl in prompt.split("\n"):
                    lines.append(f"      {pl}")

                lines.append("")

        return "\n".join(lines)

    def _build_component_prompt(self, comp: "Component") -> str:
        """Generate the LLM build prompt for a single component."""
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

        return "\n".join(prompt_lines)
