"""Core Decomposition Engine — parses dense specs into parallel execution waves.

Takes the Architecture Agent's Dense Architecture Specification and splits it
into waves of single-function components for parallel processing.

Pipeline: parse_spec → extract_components → build_dependency_graph →
          generate_interfaces → topological_wave_sort → apply_phase_adjustments →
          calculate_metrics → WavePlan
"""

import json
import re
import sys
from collections import defaultdict
from typing import Optional

from .channels import ChannelRegistry
from .decompose_patterns import PatternComponentExtractor
from .llm_judge import (
    PHASE_CHANNEL_WEIGHTS,
    ProviderConfig,
    ProviderType,
    ProjectPhase,
    QUERY_FUNCTIONS,
    _parse_llm_response,
)
from .wave_plan import (
    COMPLEXITY_MINUTES,
    Component,
    DependencyEdge,
    InterfaceContract,
    Wave,
    WavePlan,
    WavePlanMetrics,
)


# ── Spec parser ──

# Map display names in spec headers back to channel IDs
_CHANNEL_NAME_TO_ID = {
    "purpose": "purpose",
    "data model": "data_model",
    "data_model": "data_model",
    "api": "api",
    "tech stack": "tech_stack",
    "tech_stack": "tech_stack",
    "auth": "auth",
    "deployment": "deployment",
    "error handling": "error_handling",
    "error_handling": "error_handling",
    "performance": "performance",
    "security": "security",
    "testing": "testing",
}


def parse_spec(spec: str) -> dict[str, list[str]]:
    """Parse a Dense Architecture Specification into channel sections.

    Returns dict mapping channel_id to list of constraint strings.
    """
    sections: dict[str, list[str]] = {}
    current_channel: Optional[str] = None

    for line in spec.splitlines():
        stripped = line.strip()

        # Section header: "## Purpose" or "## Tech Stack"
        if stripped.startswith("## "):
            header = stripped[3:].strip()
            # Skip meta sections
            if header.lower() in ("all constraints (flat)", "implementation rules"):
                current_channel = None
                continue
            ch_id = _CHANNEL_NAME_TO_ID.get(header.lower())
            if ch_id:
                current_channel = ch_id
                sections.setdefault(ch_id, [])
            else:
                current_channel = None
            continue

        # Constraint line: "- Objective: collaborative task management API"
        if current_channel and stripped.startswith("- "):
            constraint = stripped[2:].strip()
            if constraint:
                sections[current_channel].append(constraint)

    return sections


# ── LLM system prompt for component extraction ──

_DECOMPOSE_SYSTEM_PROMPT = """You are a software architecture decomposition specialist. Given a Dense Architecture Specification, identify SINGLE-FUNCTION components that can be independently implemented.

Rules:
- Each component should have ONE responsibility (single-function = confabulation firewall)
- Components map to real code artifacts: models, services, handlers, middleware, configs
- Extract entity names from the Data Model section → one Model component per entity
- Extract resource paths from API section → one Handler component per resource
- Auth → AuthService + AuthMiddleware
- Database/cache configs → Config components
- Error handling, rate limiting → Middleware components
- Testing → TestSuite component
- Assign complexity: "low" (simple CRUD/config), "medium" (business logic), "high" (auth, real-time, complex integrations)

Return ONLY valid JSON:
{
  "components": [
    {"id": "kebab-case-id", "name": "PascalCaseName", "type": "model|service|middleware|handler|config|test",
     "description": "one line", "channels": ["channel_id"], "constraints": ["relevant constraints"],
     "interfaces_provided": ["IName"], "interfaces_consumed": ["IName"], "complexity": "low|medium|high"}
  ],
  "dependencies": [
    {"from": "component-id", "to": "component-id", "reason": "why"}
  ]
}"""


# ── Wave label generation ──

_WAVE_LABELS = {
    0: "Interface Definitions",
    1: "Foundation (Models + Config)",
    2: "Services",
    3: "Handlers + Middleware",
    4: "Cross-Cutting + Tests",
}


def _wave_label(number: int, components: list[Component]) -> str:
    """Generate a descriptive label for a wave."""
    if number in _WAVE_LABELS:
        return _WAVE_LABELS[number]

    types = {c.component_type for c in components}
    if types == {"test"}:
        return "Tests"
    if "handler" in types:
        return "Handlers"
    if "service" in types:
        return "Services"
    return f"Wave {number}"


# ── Core engine ──

class DecompositionEngine:
    """Decomposes a Dense Architecture Specification into parallel execution waves."""

    def __init__(self, phase: ProjectPhase = ProjectPhase.MVP,
                 llm_config: Optional[ProviderConfig] = None):
        self._phase = phase
        self._llm_config = llm_config
        self._pattern_extractor = PatternComponentExtractor()
        self._method_used: str = "regex"

    @property
    def method_used(self) -> str:
        return self._method_used

    def decompose(self, spec: str, registry: Optional[ChannelRegistry] = None) -> WavePlan:
        """Main entry point. Parse spec, extract components, build waves.

        Args:
            spec: Dense Architecture Specification string
            registry: Optional ChannelRegistry for additional context

        Returns:
            WavePlan with waves, interfaces, dependency graph, and metrics
        """
        # Step 1: Parse spec into channel sections
        sections = parse_spec(spec)

        # Step 2: Extract components (LLM with regex fallback)
        components, edges = self._extract_components(spec, sections)

        # Step 3: Generate interface contracts
        interfaces = self._pattern_extractor.generate_interfaces(components, sections)

        # Step 4: Topologically sort into waves
        waves = self._topological_wave_sort(components, edges)

        # Step 5: Apply phase adjustments
        waves = self._apply_phase_adjustments(waves)

        # Step 6: Calculate metrics
        metrics = self._calculate_metrics(waves, edges)

        return WavePlan(
            waves=waves,
            interfaces=interfaces,
            dependency_graph=edges,
            phase=self._phase.value,
            metrics=metrics,
        )

    def _extract_components(self, spec: str,
                            sections: dict[str, list[str]]) -> tuple[list[Component], list[DependencyEdge]]:
        """Extract components using LLM with regex fallback."""
        self._method_used = "regex"

        # Try LLM extraction
        if self._llm_config and self._llm_config.type != ProviderType.REGEX:
            llm_result = self._extract_via_llm(spec)
            if llm_result is not None:
                components, edges = llm_result
                if components:
                    self._method_used = f"{self._llm_config.type.value}:{self._llm_config.model}"
                    return components, edges

        # Fallback to regex patterns
        return self._pattern_extractor.extract(sections)

    def _extract_via_llm(self, spec: str) -> Optional[tuple[list[Component], list[DependencyEdge]]]:
        """Try to extract components using the configured LLM provider."""
        query_fn = QUERY_FUNCTIONS.get(self._llm_config.type)
        if not query_fn:
            return None

        print(f"[Decomposer] Querying {self._llm_config.type.value}:{self._llm_config.model}", file=sys.stderr)

        # Build a decomposition-specific prompt
        prompt = f"Decompose this Dense Architecture Specification into single-function components:\n\n{spec}"

        result = query_fn(self._llm_config, prompt, context="", system_prompt=_DECOMPOSE_SYSTEM_PROMPT)
        if result is None or "components" not in result:
            print("[Decomposer] LLM extraction failed, falling back to regex", file=sys.stderr)
            return None

        components = []
        comp_ids = set()
        for raw in result.get("components", []):
            cid = raw.get("id", "")
            if not cid or cid in comp_ids:
                continue
            comp_ids.add(cid)
            components.append(Component(
                id=cid,
                name=raw.get("name", cid),
                description=raw.get("description", ""),
                component_type=raw.get("type", "service"),
                channel_sources=raw.get("channels", []),
                constraints=raw.get("constraints", []),
                interfaces_provided=raw.get("interfaces_provided", []),
                interfaces_consumed=raw.get("interfaces_consumed", []),
                estimated_complexity=raw.get("complexity", "medium"),
            ))

        edges = []
        for raw in result.get("dependencies", []):
            from_id = raw.get("from", "")
            to_id = raw.get("to", "")
            if from_id in comp_ids and to_id in comp_ids:
                edges.append(DependencyEdge(
                    from_component=from_id,
                    to_component=to_id,
                    reason=raw.get("reason", ""),
                ))

        return components, edges

    def _topological_wave_sort(self, components: list[Component],
                               edges: list[DependencyEdge]) -> list[Wave]:
        """Sort components into waves using Kahn's algorithm.

        Wave 0 is always interface-type components (or empty if none).
        Subsequent waves group all components whose dependencies are satisfied.
        """
        if not components:
            return []

        comp_map = {c.id: c for c in components}

        # Separate interface components for Wave 0
        interface_comps = [c for c in components if c.component_type == "interface"]
        non_interface = [c for c in components if c.component_type != "interface"]

        waves: list[Wave] = []

        # Wave 0: Interfaces
        if interface_comps:
            waves.append(Wave(number=0, label="Interface Definitions", components=interface_comps))

        if not non_interface:
            return waves

        # Build adjacency and in-degree for non-interface components
        in_degree: dict[str, int] = {c.id: 0 for c in non_interface}
        dependents: dict[str, list[str]] = defaultdict(list)

        for edge in edges:
            # Only count edges between non-interface components
            if edge.from_component in in_degree and edge.to_component in in_degree:
                in_degree[edge.from_component] += 1
                dependents[edge.to_component].append(edge.from_component)

        # Kahn's algorithm collecting all zero-in-degree nodes per wave
        wave_num = 1 if waves else 0
        remaining = dict(in_degree)

        while remaining:
            ready = [cid for cid, deg in remaining.items() if deg == 0]

            if not ready:
                # Cycle detected — break by picking lowest in-degree node
                min_deg = min(remaining.values())
                ready = [cid for cid, deg in remaining.items() if deg == min_deg][:1]
                print(f"[Decomposer] Cycle detected, breaking at {ready[0]}", file=sys.stderr)

            wave_comps = [comp_map[cid] for cid in ready if cid in comp_map]
            label = _wave_label(wave_num, wave_comps)
            waves.append(Wave(number=wave_num, label=label, components=wave_comps))

            # Remove ready nodes and update in-degrees
            for cid in ready:
                del remaining[cid]
                for dependent in dependents.get(cid, []):
                    if dependent in remaining:
                        remaining[dependent] -= 1

            wave_num += 1

        return waves

    def _apply_phase_adjustments(self, waves: list[Wave]) -> list[Wave]:
        """Prune components and cap wave count based on project phase."""
        phase_config = PHASE_CHANNEL_WEIGHTS.get(self._phase, {})
        critical = phase_config.get("critical", set())
        optional = phase_config.get("optional", set())

        max_waves = {
            ProjectPhase.POC: 3,
            ProjectPhase.MVP: 5,
            ProjectPhase.PREPROD: 999,
        }.get(self._phase, 5)

        adjusted: list[Wave] = []
        for wave in waves:
            # Filter: keep components that have at least one critical channel source
            # or components with no channel sources (shouldn't happen, but safe)
            filtered_comps = []
            for comp in wave.components:
                sources = set(comp.channel_sources)
                # Keep if any source is critical, or if no sources are purely optional
                if sources & critical or not (sources and sources <= optional):
                    filtered_comps.append(comp)

            if filtered_comps:
                adjusted.append(Wave(
                    number=len(adjusted),
                    label=wave.label,
                    components=filtered_comps,
                ))

        # Cap wave count by merging trailing waves
        if len(adjusted) > max_waves:
            merged_comps: list[Component] = []
            for extra_wave in adjusted[max_waves - 1:]:
                merged_comps.extend(extra_wave.components)
            adjusted = adjusted[:max_waves - 1]
            adjusted.append(Wave(
                number=max_waves - 1,
                label="Remaining Components",
                components=merged_comps,
            ))

        return adjusted

    def _calculate_metrics(self, waves: list[Wave],
                           edges: list[DependencyEdge]) -> WavePlanMetrics:
        """Calculate plan metrics."""
        total_components = sum(len(w.components) for w in waves)
        total_waves = len(waves)
        max_parallelism = max((w.parallel_count for w in waves), default=0)
        components_per_wave = [w.parallel_count for w in waves]

        # Dependency depth: longest path in DAG
        dependency_depth = self._longest_path(edges, waves)

        # Time estimates
        seq_total = sum(w.estimated_time_sequential for w in waves)
        par_total = sum(w.estimated_time_parallel for w in waves)

        if seq_total > 0:
            savings = ((seq_total - par_total) / seq_total) * 100
        else:
            savings = 0.0

        parallelism_ratio = max_parallelism / total_components if total_components > 0 else 0.0

        return WavePlanMetrics(
            total_components=total_components,
            total_waves=total_waves,
            max_parallelism=max_parallelism,
            dependency_depth=dependency_depth,
            parallelism_ratio=parallelism_ratio,
            estimated_sequential_minutes=seq_total,
            estimated_parallel_minutes=par_total,
            time_savings_percent=savings,
            components_per_wave=components_per_wave,
        )

    def _longest_path(self, edges: list[DependencyEdge], waves: list[Wave]) -> int:
        """Compute longest path in the dependency DAG."""
        if not edges:
            return len(waves)

        # Build adjacency for longest path
        adj: dict[str, list[str]] = defaultdict(list)
        all_nodes: set[str] = set()
        for edge in edges:
            adj[edge.to_component].append(edge.from_component)
            all_nodes.add(edge.from_component)
            all_nodes.add(edge.to_component)

        memo: dict[str, int] = {}

        def _dfs(node: str) -> int:
            if node in memo:
                return memo[node]
            memo[node] = 0  # Mark visiting to prevent infinite loops
            max_child = 0
            for child in adj.get(node, []):
                if child not in memo or memo[child] > 0:
                    max_child = max(max_child, _dfs(child))
            memo[node] = 1 + max_child
            return memo[node]

        return max((_dfs(n) for n in all_nodes), default=1)


# ── CLI and programmatic entry points ──

def run_decompose_programmatic(spec: str, registry: Optional[ChannelRegistry] = None,
                               phase: str = "mvp",
                               llm_config: Optional[ProviderConfig] = None) -> WavePlan:
    """Programmatic entry point: returns WavePlan."""
    project_phase = ProjectPhase(phase)
    engine = DecompositionEngine(phase=project_phase, llm_config=llm_config)
    return engine.decompose(spec, registry)


def _progress_bar(count: int, total: int, width: int = 20) -> str:
    ratio = count / total if total > 0 else 0
    filled = int(ratio * width)
    return f"[{'█' * filled}{'░' * (width - filled)}] {count}/{total}"


def run_decompose_interactive(spec: str, registry: Optional[ChannelRegistry] = None,
                              phase: str = "mvp", output_path: Optional[str] = None,
                              llm_config: Optional[ProviderConfig] = None):
    """CLI entry point: prints wave plan with progress visualization."""
    project_phase = ProjectPhase(phase)
    engine = DecompositionEngine(phase=project_phase, llm_config=llm_config)

    print("╔══════════════════════════════════════╗")
    print("║   Decomposition Agent — Wave Plan     ║")
    print(f"║   Phase: {phase.upper():<29}║")
    print("╚══════════════════════════════════════╝\n")

    print("Parsing specification...")
    wave_plan = engine.decompose(spec, registry)
    print(f"Method: {engine.method_used}\n")

    # Display metrics
    m = wave_plan.metrics
    print("── Metrics ──")
    print(f"  Components:     {m.total_components}")
    print(f"  Waves:          {m.total_waves}")
    print(f"  Max Parallelism: {m.max_parallelism}x")
    print(f"  Dependency Depth: {m.dependency_depth}")
    print(f"  Sequential Time: {m.estimated_sequential_minutes:.0f} min")
    print(f"  Parallel Time:   {m.estimated_parallel_minutes:.0f} min")
    print(f"  Time Savings:    {m.time_savings_percent:.0f}%")
    print("──────────────\n")

    # Display waves
    for wave in wave_plan.waves:
        print(f"Wave {wave.number}: {wave.label}")
        bar = _progress_bar(wave.parallel_count, m.total_components)
        print(f"  {bar}")
        for comp in wave.components:
            channels = ", ".join(comp.channel_sources)
            print(f"  • {comp.name} [{channels}] — {comp.description}")
        print()

    # Output
    markdown = wave_plan.to_markdown()
    if output_path:
        with open(output_path, "w") as f:
            f.write(markdown)
        print(f"Wave plan written to {output_path}")
    else:
        print("\n" + "=" * 60)
        print(markdown)
        print("=" * 60)

    return wave_plan
