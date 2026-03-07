# How LLMs Actually Work - Interactive Presentation

An interactive, locally-hosted presentation that walks through the core concepts behind large language models using four hands-on visualizations.

## Topics Covered

- **Self-Attention** - Step through the Query/Key/Value computation that lets transformers understand word relationships
- **Attention Dilution** - See how noise tokens steal probability mass from meaningful words
- **Context Density** - Compare three versions of the same prompt and learn why token-level information density matters
- **Feature Activation Landscape** - 3D rotatable grid showing how specific tokens create sharp activation peaks while vague tokens stay flat across layers
- **How Landscape Impacts Output** - Three-part exploration of training data defaults, Top-K sampling interaction, and confabulation pathways from unresolved prompt dimensions
- **Hallucination Map** - Token-by-token trace of generated output, color-coded by grounding status, with clickable logit distributions at each position
- **Language vs. Thought** - Explore the distinction between formal competence (grammar, syntax) and functional competence (reasoning, world knowledge)

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

## Install & Run

```bash
cd presentation
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Navigation

- **Arrow keys** (left/right) move between slides
- **Previous / Next** buttons in the bottom nav bar
- **Dot indicators** are clickable - blue dots are interactive demo slides
- Each demo slide has a sticky instruction bar explaining how to interact

## Project Structure

```
├── presentation/          # Vite + React app
│   └── src/
│       ├── App.jsx        # Slide framework and navigation
│       └── components/
│           ├── AttentionAnimation.jsx   # Self-attention step-through
│           ├── AttentionDilution.jsx    # Noise vs. signal demo
│           ├── ContextDensity.jsx       # Prompt comparison tool
│           ├── FeatureGrid3D.jsx        # 3D feature activation landscape
│           ├── LandscapeOutput.jsx      # How landscape impacts output
│           ├── HallucinationMap.jsx     # Token-by-token hallucination trace
│           └── DissociatingViz.jsx      # Language vs. thought explorer
├── attention_animation (1).jsx          # Original source files
├── attention_dilution (1).jsx
├── context_density (2).jsx
└── dissociating_viz.jsx
```
