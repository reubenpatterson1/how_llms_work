"""Architecture Agent CLI — interactive and programmatic intake.

Drives the structured Q&A, displays progress, and generates the
Dense Architecture Specification.
"""

import sys
from .channels import ChannelRegistry
from .intake import IntakeEngine
from .spec_generator import SpecGenerator


def _progress_bar(resolution: float, width: int = 20) -> str:
    filled = int(resolution * width)
    return f"[{'█' * filled}{'░' * (width - filled)}] {resolution:.0%}"


def _print_dashboard(registry: ChannelRegistry):
    print("\n── Channel Resolution ──")
    for ch_id, channel in registry.channels.items():
        bar = _progress_bar(channel.resolution)
        print(f"  {channel.name:<16} {bar}")
    score = registry.overall_density_score()
    print(f"\n  Overall Density: {score:.1%}")
    print("────────────────────────\n")


def run_interactive(output_path: str | None = None, verbose: bool = False):
    """Run interactive Q&A intake in the terminal."""
    registry = ChannelRegistry()
    engine = IntakeEngine(registry)

    print("╔══════════════════════════════════════╗")
    print("║    Architecture Agent — Intake        ║")
    print("║    Fill channels to maximize density   ║")
    print("╚══════════════════════════════════════╝\n")

    question = engine.first_question()

    while True:
        print(f"Q: {question}")
        print()

        try:
            response = input("→ ")
        except (EOFError, KeyboardInterrupt):
            print("\n\nIntake cancelled.")
            return

        if not response.strip():
            print("(empty response — skipping)\n")
            continue

        result = engine.process_response(response)

        if verbose and result.updates:
            print(f"\n  ✓ {len(result.updates)} dimension(s) updated")
            for u in result.updates:
                print(f"    • {u.channel_id}.{u.sub_dimension} → {u.resolution:.0%} ({u.constraint})")

        if result.ambiguities:
            print("\n  ⚠ Ambiguities detected:")
            for a in result.ambiguities:
                print(f"    • \"{a.text}\" — {a.reason}")

        _print_dashboard(registry)

        if result.is_complete:
            print("All channels resolved!\n")
            break

        question = result.next_question
        if question is None:
            break

    # Generate spec
    gen = SpecGenerator(registry)
    spec = gen.generate()

    if output_path:
        with open(output_path, "w") as f:
            f.write(spec)
        print(f"Specification written to {output_path}")
    else:
        print("\n" + "=" * 60)
        print(spec)
        print("=" * 60)

    return spec


def run_programmatic(responses: list[str], verbose: bool = False) -> tuple[str, ChannelRegistry, list[dict]]:
    """Run intake with pre-defined responses. Returns (spec, registry, snapshots)."""
    registry = ChannelRegistry()
    engine = IntakeEngine(registry)

    for response in responses:
        result = engine.process_response(response)

        if verbose:
            _print_dashboard(registry)
            if result.ambiguities:
                for a in result.ambiguities:
                    print(f"  ⚠ \"{a.text}\" — {a.reason}", file=sys.stderr)

        if result.is_complete:
            break

    gen = SpecGenerator(registry)
    spec = gen.generate()
    snapshots = engine.get_snapshots()

    return spec, registry, snapshots


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Architecture Agent — structured intake for dense specs")
    parser.add_argument("--output", "-o", help="Output file path for specification")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed updates")
    args = parser.parse_args()

    run_interactive(output_path=args.output, verbose=args.verbose)


if __name__ == "__main__":
    main()
