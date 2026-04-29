"""Generates Dense Architecture Specification from resolved channels.

Output is one-line-per-constraint format — maximum density, no prose,
optimized for LLM consumption.
"""

from .channels import ChannelRegistry


class SpecGenerator:
    """Generates a dense, constraint-oriented architecture specification."""

    def __init__(self, registry: ChannelRegistry):
        self.registry = registry

    def generate(self) -> str:
        lines = [
            "# Dense Architecture Specification",
            f"# Density Score: {self.registry.overall_density_score():.3f}",
            "",
        ]

        for ch_id, channel in self.registry.channels.items():
            if channel.resolution < 0.01:
                continue

            lines.append(f"## {channel.name}")
            lines.append(f"# Resolution: {channel.resolution:.1%}")
            lines.append("")

            for sub_id, sub in channel.sub_dimensions.items():
                # Emit sub-dimension labels so the decomposer's pattern extractor
                # can find structured components (Database:, Endpoints:, Entity:, ...).
                # The label is derived from the sub-dim id (snake_case → Title Case).
                sub_label = sub_id.replace("_", " ").title()
                if sub.constraints:
                    for constraint in sub.constraints:
                        # Avoid double-labelling if the constraint already contains the label.
                        if constraint.lower().lstrip("- ").startswith(sub_label.lower() + ":"):
                            lines.append(f"- {constraint}")
                        else:
                            lines.append(f"- {sub_label}: {constraint}")
                elif sub.resolution > 0:
                    lines.append(f"- {sub_label}: [partially specified, {sub.resolution:.0%}]")

            lines.append("")

        # Summary constraints section
        all_constraints = []
        for ch in self.registry.channels.values():
            all_constraints.extend(ch.constraints)

        if all_constraints:
            lines.append("## All Constraints (Flat)")
            lines.append("")
            for c in all_constraints:
                lines.append(f"- {c}")
            lines.append("")

        lines.append("## Implementation Rules")
        lines.append("")
        lines.append("- Every architectural decision MUST trace to a constraint above")
        lines.append("- If a dimension has no constraint, ASK — do not invent")
        lines.append("- Prefer explicit over implicit in all generated code")
        lines.append("- No defaults: every value must come from this spec")
        lines.append("")

        return "\n".join(lines)

    def density_score(self) -> float:
        return self.registry.overall_density_score()

    def unresolved_summary(self) -> str:
        unresolved = self.registry.get_unresolved(0.8)
        if not unresolved:
            return "All channels fully resolved."

        lines = ["Unresolved channels:"]
        for ch in unresolved:
            low_subs = ch.get_unresolved(0.8)
            sub_names = ", ".join(s.name for s in low_subs)
            lines.append(f"  - {ch.name} ({ch.resolution:.0%}): {sub_names}")
        return "\n".join(lines)
