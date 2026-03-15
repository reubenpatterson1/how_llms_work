# LLM Presentation Suite

Two interactive, locally-hosted presentations covering LLM theory and applied engineering methodology.

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

## Architecture Agent (`architect/`)

Python CLI that performs structured Q&A intake to fill 10 architectural channels with constraint-oriented tokens. Generates a Dense Architecture Specification for one-shot LLM execution.

```bash
cd architect && pip install -r requirements.txt
python -m pytest tests/ -v          # Run 75 tests
python -m architect.agent --verbose  # Interactive mode
```

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- Python 3.12 or later

## Navigation (both presentations)

- **Arrow keys** (left/right) move between slides
- **Previous / Next** buttons in the bottom nav bar
- **Dot indicators** are clickable - blue dots are interactive demo slides

## Project Structure

```
├── presentation/              # Part 1: How LLMs Actually Work (port 5173)
│   └── src/
│       ├── App.jsx
│       └── components/        # 10 interactive visualization components
├── working-with-llms/         # Part 2: How to Work WITH LLMs (port 5174)
│   └── src/
│       ├── App.jsx
│       ├── data/test_results.json  # Generated comparative data
│       └── components/        # 7 interactive components + quiz
├── architect/                 # Python Architecture Agent
│   ├── channels.py            # 10-channel registry with sub-dimensions
│   ├── analyzer.py            # Pattern matching + ambiguity detection
│   ├── intake.py              # Structured Q&A engine
│   ├── spec_generator.py      # Dense Architecture Specification output
│   ├── agent.py               # CLI interface
│   ├── mock_llm.py            # Pre-tagged vague vs dense outputs
│   ├── comparator.py          # Metric collection + JSON export
│   └── tests/                 # 75 tests including e2e pipeline
```
