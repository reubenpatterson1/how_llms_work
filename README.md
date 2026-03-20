# LLM Presentation Suite

Two interactive, locally-hosted presentations covering LLM theory and applied engineering methodology — plus a two-stage agent pipeline that puts it into practice.

## Part 1: How LLMs Actually Work (`presentation/`)

An interactive journey through attention, context, and cognition.

### Topics Covered

- **Self-Attention** - Step through the Query/Key/Value computation that lets transformers understand word relationships
- **Where Weights Come From** - 3D visualization of how training corpus co-occurrence builds the 3x3 attention weight matrix
- **Attention Dilution** - See how noise tokens steal probability mass from meaningful words
- **Context Density** - Compare three versions of the same prompt and learn why token-level information density matters
- **Feature Activation Landscape** - 3D rotatable grid showing how specific tokens create sharp activation peaks while vague tokens stay flat across layers
- **How Landscape Impacts Output** - Three-part exploration of training data defaults, Top-K sampling interaction, and confabulation pathways from unresolved prompt dimensions
- **Hallucination Map** - Token-by-token trace of generated output, color-coded by grounding status, with clickable logit distributions at each position
- **Confidence Landscape** - 3D rotatable grid showing winner vs runner-up token probabilities, sortable by confidence, entropy, and grounding status
- **Language vs. Thought** - Explore the distinction between formal competence (grammar, syntax) and functional competence (reasoning, world knowledge)
- **Engineering Professional Assessment** - 27-question quiz with certificate

```bash
cd presentation && npm install && npm run dev
# → http://localhost:5173
```

## Part 2: How to Actually Work WITH LLMs (`working-with-llms/`)

Turns Part 1 theory into a systematic engineering methodology with real comparative data.

### Topics Covered

- **Density Principle** - Why constraint-oriented tokens maximize execution and minimize invention
- **10-Channel Architecture** - Purpose, Data Model, API, Tech Stack, Auth, Deployment, Error Handling, Performance, Security, Testing
- **Architecture Agent Walkthrough** - Step-through of structured Q&A intake building a Task Management API
- **Comparative Results** - Side-by-side metrics: vague (37.5% hallucination) vs dense (0%)
- **Token-Level Hallucination Comparison** - Grounded/inferred/defaulted/confabulated token traces
- **Run-to-Run Consistency** - Architectural decision stability across 5 runs
- **Agentic Systems** - Three pillars: Monitoring, Configurability, Predictability
- **Engineering Professional Assessment** - 18-question quiz with certificate

```bash
cd working-with-llms && npm install && npm run dev
# → http://localhost:5174
```

---

## Agent Pipeline (`architect/`)

A two-stage Python agent pipeline implementing the **Spec → Decompose → Build** methodology from the presentation's Key Takeaways.

```
User Requirements
      │
      ▼
┌─────────────────────┐
│  Architecture Agent │  10-channel structured intake → Dense Spec
│    (Stage 1)        │  Eliminates prompt-level hallucination
└─────────┬───────────┘
          │  Dense Architecture Specification
          ▼
┌─────────────────────┐
│ Decomposition Agent │  Splits spec into dependency-ordered waves
│    (Stage 2)        │  Eliminates architecture-level hallucination
└─────────┬───────────┘
          │  Wave Plan (components · interfaces · dependency graph)
          ▼
    Parallel Build
    (30–65% faster)
```

### Stage 1: Architecture Agent

Structured Q&A intake fills 10 architectural channels with constraint-oriented tokens and produces a Dense Architecture Specification for one-shot LLM execution.

**Key Takeaway:** Dense specs eliminate prompt-level hallucination. Vague prompts score 37.5% hallucination; dense specs score 0%.

```bash
pip install -r architect/requirements.txt
python -m architect                   # Web UI → http://localhost:5001
python -m architect.agent --verbose   # CLI interactive mode
python -m pytest architect/tests/ -v  # Run all 75+ tests
```

### Stage 2: Decomposition Agent

Takes the Architecture Agent's dense spec and splits it into **dependency-ordered waves** for parallel LLM code generation. Applies the five First Principles from the Key Takeaways:

| Principle | Implementation |
|-----------|----------------|
| **Decompose First** | Every component is a single-function unit — each boundary is a confabulation firewall |
| **Parallelize Smartly** | Wave 0 defines all interfaces first; later waves build independently in parallel |
| **Orchestrate for Quality** | Multi-wave generation with explicit typed interface contracts |
| **Monitor Everything** | Per-wave metrics: component count, parallelism factor, time savings estimate |
| **Spec → Decompose → Build** | Stage 2 eliminates architecture-level hallucination before any code is written |

**Hello World Weather App — MVP wave plan:**

```
Wave 0 ── CityModel ── DatabaseConfig ── DeploymentConfig    (3× parallel)
               │              │
Wave 1 ── AuthService ── CacheService                        (2× parallel)
               │
Wave 2 ── AuthMiddleware ── WeatherHandler ── ForecastHandler (3× parallel)

Result: 7 components · 3 waves · 3× parallelism · 50% time savings
        140 min sequential → 70 min parallel
```

**Phase-aware filtering** automatically trims scope:

| Phase    | Components | Waves | Time Savings |
|----------|-----------|-------|-------------|
| PoC      | ~4        | 2     | ~33%        |
| MVP      | ~7        | 3     | ~50%        |
| Pre-Prod | all       | 3–4   | ~65%        |

```bash
python -m architect   # /decompose tab in the web UI
```

Or use programmatically:

```python
from architect.agent import run_programmatic
from architect.decomposer import run_decompose_programmatic

spec, registry, _ = run_programmatic(responses)
plan = run_decompose_programmatic(spec, registry, phase="mvp")
print(plan.to_markdown())
# Wave Plan: 7 components · 3 waves · 50% time savings
```

---

## Project Structure

```
├── presentation/              # Part 1: How LLMs Actually Work (port 5173)
│   └── src/
│       ├── App.jsx
│       └── components/        # 10 interactive visualization components
├── working-with-llms/         # Part 2: How to Work WITH LLMs (port 5174)
│   └── src/
│       ├── App.jsx
│       ├── data/test_results.json
│       └── components/        # 7 interactive components + quiz
└── architect/                 # Stage 1 + Stage 2 Agent Pipeline
    ├── channels.py            # 10-channel registry with sub-dimensions
    ├── analyzer.py            # Pattern matching + ambiguity detection
    ├── intake.py              # Structured Q&A engine
    ├── spec_generator.py      # Dense Architecture Specification output
    ├── agent.py               # CLI + programmatic interface
    ├── decomposer.py          # Stage 2: DecompositionEngine + wave orchestration
    ├── decompose_patterns.py  # Component / interface / dependency extraction
    ├── wave_plan.py           # WavePlan, Wave, Component, WaveMetrics dataclasses
    ├── webapp.py              # Flask web UI (Architecture + Decompose tabs)
    ├── mock_llm.py            # Pre-tagged vague vs dense outputs
    ├── comparator.py          # Metric collection + JSON export
    └── tests/                 # 75+ tests: unit, integration, e2e pipeline
        ├── test_wave_plan.py
        ├── test_decomposer.py
        └── test_decompose_e2e.py
```

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- Python 3.12 or later

## Navigation (both presentations)

- **Arrow keys** (left/right) move between slides
- **Previous / Next** buttons in the bottom nav bar
- **Dot indicators** are clickable — blue dots are interactive demo slides
