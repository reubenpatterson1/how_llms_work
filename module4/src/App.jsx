import { useState } from 'react';
import WaveGridReplay from './components/WaveGridReplay';
import Assessment from './components/Assessment';
import './index.css';

const SLIDES = [
  { id: 's1', type: 'text', title: 'How to Build/Deploy with LLMs',
    body: 'Module 4 — the architect → decompose → build → deploy pipeline, end to end on a real app.' },

  { id: 's2', type: 'text', title: "What We'll Cover",
    body: '1. Recap of Decompose output\n2. The Build Agent\n3. Wave-parallelism payoff\n4. The Deploy Agent\n5. Live URL\n6. What this doesn\'t cover (→ Module 5)' },

  { id: 's3', type: 'text', title: 'The Pipeline End to End',
    body: 'Spec → Decompose → Build → Deploy. Four stages, four artifacts: dense spec, build-package YAML, container image + manifest, live URL.' },

  { id: 's4', type: 'text', title: 'Recap: What Comes Out of Decompose',
    body: 'A YAML DAG. Each node is a component with: id, type, wave, complexity, constraints, prompt. Wave assignment encodes parallelism — Wave 0 components have no inter-dependencies, Wave 1 depends on Wave 0 outputs.' },

  { id: 's5', type: 'text', title: "The Build Agent's Job",
    body: 'For each wave (sequentially): dispatch all components in parallel to the LLM, write each output to disk, advance to next wave. Then assemble the project skeleton: manifest, Dockerfile, .env.example.' },

  { id: 's6', type: 'text', title: 'Why Wave-Parallel Matters',
    body: 'Sequential build of N components ≈ N × per-component time. Wave-parallel: max(wave_0_time) + max(wave_1_time) + ... For a 4-component build with 2 waves of 2, parallelism roughly halves wall-clock time.' },

  { id: 's7', type: 'component', title: 'Wave-Grid Animation', component: 'WaveGridReplay' },

  { id: 's8', type: 'text', title: 'LLM of Choice',
    body: 'The build-package YAML is provider-agnostic — any model that can follow the wrapped prompt format works. Default in this build: local Ollama with mistral:7b. Bigger models give better single-shot quality; the wrapping layer normalizes a lot of the gap.' },

  { id: 's9', type: 'text', title: 'What Gets Generated',
    body: 'Per component: one source file (.js or .py). Per project: package.json or requirements.txt, Dockerfile, .env.example, index.html shell if frontend. The build agent writes everything to a versioned workspace folder.' },

  { id: 's10', type: 'text', title: 'Foreshadowing: That .env.example',
    body: "We're emitting an OPENWEATHER_API_KEY= placeholder, which means the real key has to come from somewhere. That somewhere — secrets and config management — is its own module. For now: the .env.example exists so a developer knows what to fill in." },

  { id: 's11', type: 'text', title: 'The Deploy Step',
    body: 'Take the deploy YAML template, fill in auto-derived fields (image, port, healthcheck path, ingress host), let the user customize the rest, then build → push → apply.' },

  { id: 's12', type: 'text', title: 'Anatomy of the Deploy YAML',
    body: 'fubo Application CRD: apiVersion app.smo.tools.fubotv.net/v1alpha1. Key fields: image, replicas, resources, ports, healthcheck (must match what your app actually serves), ingress host (must be unique).' },

  { id: 's13', type: 'text', title: 'Image Build & Push',
    body: 'docker build → docker tag → docker push to ECR. The agent expects you to have a fresh ECR docker login (12hr TTL). On auth error it surfaces the exact "aws ecr get-login-password" command to copy-paste.' },

  { id: 's14', type: 'text', title: 'Live URL',
    body: 'After kubectl apply, the agent polls the ingress until it serves HTTP 200 — typically ~90s for first deploy as Route 53 + ALB target registration settle. Then the URL is clickable.' },

  { id: 's15', type: 'text', title: 'Live Walkthrough',
    body: 'Switch to architect tool now → walk Stages 1-3 with the HelloWorld spec.' },

  { id: 's16', type: 'text', title: "What This Doesn't Cover",
    body: 'No automated tests run as part of the build. No deploy-config validation. No health-monitoring dashboards. No rollback or blue-green. All of that is Module 5: Testing & CI/CD.' },

  { id: 's17', type: 'text', title: 'Recap',
    body: 'Four stages: Spec → Decompose → Build → Deploy. Four artifacts: dense spec, build-package YAML, container image, live URL. The agent is yours to run on your own apps now.' },

  { id: 's18', type: 'assessment', title: 'Assessment',
    body: '8-10 MCQ on pipeline mechanics. Skeleton MCQ component lives in src/components/Assessment.jsx (will be expanded in a follow-up).' },
];

const COMPONENTS = { WaveGridReplay, Assessment };

export default function App() {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  const renderBody = () => {
    if (slide.type === 'component') {
      const Comp = COMPONENTS[slide.component];
      return <Comp />;
    }
    if (slide.type === 'assessment') {
      const Comp = COMPONENTS['Assessment'];
      return <Comp />;
    }
    return <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{slide.body}</pre>;
  };

  return (
    <div className="app">
      <header>{slide.title}</header>
      <main>{renderBody()}</main>
      <footer>
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Prev</button>
        <span>{idx + 1} / {SLIDES.length}</span>
        <button disabled={idx === SLIDES.length - 1} onClick={() => setIdx(idx + 1)}>Next</button>
      </footer>
    </div>
  );
}
