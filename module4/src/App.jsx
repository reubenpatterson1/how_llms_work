import { useState, useEffect } from 'react';
import WaveGridReplay from './components/WaveGridReplay';
import PipelineFlow from './components/PipelineFlow';
import BuildFlow from './components/BuildFlow';
import DeployFlow from './components/DeployFlow';
import Assessment from './components/Assessment';
import DeploymentStack from './components/DeploymentStack';
import architectDashboardImg from './assets/screenshots/architect-dashboard.png';
import decomposeSpecLoadedImg from './assets/screenshots/decompose-spec-loaded.png';
import decomposeWavePlanImg from './assets/screenshots/decompose-wave-plan.png';
import buildUiImg from './assets/screenshots/build-ui.png';
import deployUiImg from './assets/screenshots/deploy-ui.png';
import deployManualApplyImg from './assets/screenshots/deploy-manual-apply.png';
import quoteAppLiveImg from './assets/screenshots/quote-app-live.png';
import './index.css';
import './App.css';

const SAMPLE_SPEC_HIGHLIGHT = `# Dense Architecture Specification — Team Task Tracker (MVP)
# Density Score: 0.540

## Purpose
- Objective: Ship a team task tracker for engineering teams
- Success Criteria: P95 page load under 800ms

## Data Model
- Entities: User, Team, Task, Comment (with full attribute lists)
- Relationships: User belongs to Team; Task belongs to Team + assignee
- Constraints: User.email unique; Task.status in {todo,doing,done,blocked}

## API
- GET /api/teams/:teamId/tasks
- POST /api/teams/:teamId/tasks
- PATCH /api/tasks/:id
- POST /api/tasks/:id/comments

## Tech Stack
- TypeScript 5.4, Hono on Bun, PostgreSQL 15 + Drizzle, Redis 7

## Auth
- JWT RS256, RBAC owner/admin/member, 15m access + 30d refresh

## Deployment
- fly.io 2 regions, GitHub Actions, preview-per-PR + staging + prod`;

const SLIDES = [
  { id: 's0a', type: 'text', title: 'The Deployment Stack: What You Are Actually Doing',
    body: 'Before any LLM tooling: every Kubernetes deployment is built from the same set of components in a fixed dependency order.\n\n1. Local Codebase — your app code, a Dockerfile, and a Helm chart / K8s manifest live together in the repo.\n2. Docker Image — the Dockerfile compiles your code into an immutable runtime artifact and pushes it to a registry (ECR).\n3. Helm Chart / K8s Manifest — references the image tag and tells K8s how to run it: replicas, resources, ingress host.\n4. GitHub Branch — the branch is the unit of review; nothing deploys until it merges.\n5. PR & Merge — the merge event fires the deploy pipeline.\n6. GH Actions Workflow — builds the Docker image, pushes it, then applies the Helm chart automatically.\n   ↳ No CI/CD yet? Run those same three steps yourself from the command line (the "direct path").\n7. Live URL — Ingress + ALB + Route 53 route traffic to your running pod.\n\nNext slide: step through each component interactively.' },

  { id: 's0b', type: 'component', title: 'Deployment Stack: Dependencies & Order of Operations',
    component: 'DeploymentStack' },

  { id: 's1', type: 'text', title: 'How to Build/Deploy with LLMs',
    body: '1. Recap of Decompose output\n2. The Build Agent\n3. Wave-parallelism payoff\n4. The Deploy Agent\n5. Live URL\n6. What this doesn\'t cover (→ Module 5)' },

  { id: 's2', type: 'component', title: 'Idea → Architect → Decompose → Build → Deploy → Test',
    component: 'PipelineFlow' },

  { id: 's3', type: 'text', title: 'The Pipeline End to End',
    body: 'Spec → Decompose → Build → Deploy. Four stages, four artifacts: dense spec, build-package YAML, container image + manifest, live URL.' },

  { id: 's4a', type: 'image', title: 'The Architect Agent',
    image: architectDashboardImg,
    caption: 'The Architecture Agent runs structured Q&A across 10 channels. Output: a dense spec with constraints traceable to every decision. (Modules 1-2 cover this in depth.)' },

  { id: 's4b', type: 'codeblock', title: 'The Dense Spec That Comes Out',
    intro: 'Worked example: a team task tracker for engineering sprints. 4 entities, 4 endpoints, JWT auth, fly.io deploy. This is the input the Decompose agent will turn into a wave plan.',
    code: SAMPLE_SPEC_HIGHLIGHT },

  { id: 's4c', type: 'image', title: 'Decompose: Load the Spec',
    image: decomposeSpecLoadedImg,
    caption: 'Paste the dense spec into the Decompose page (skip re-running intake). Status flips to "using upload" — Run Decompose now uses your pasted content.' },

  { id: 's4d', type: 'image', title: 'Decompose Output: 15 Components, 3 Waves, 73% Time Saved',
    image: decomposeWavePlanImg,
    caption: 'Wave 0: 6 interface definitions (4 entity models + 2 configs) — fully parallel. Wave 1: services that depend on configs. Wave 2: handlers + middleware. Right side: machine-readable interface contracts and the dependency graph.' },

  { id: 's4', type: 'codeblock', title: 'The Build Package That Comes Out',
    intro: 'The decompose run produces a full build package — 4 parts, ~500 lines for this MVP. Excerpt below shows the structure: spec recap, wave plan, interface contracts (with Owner + Types), and per-component build prompts (the actual LLM payload).',
    code: `# Build Package — MVP
# 15 components · 3 waves · 7× parallelism · 73% time savings

═══ Part 1: Dense Architecture Specification ═════════════════════
(spec.md verbatim — Purpose, Data Model, API, Tech Stack, Auth,
 Deployment, Performance, All Constraints, Implementation Rules)

═══ Part 2: Wave Plan ════════════════════════════════════════════

## Wave 0: Interface Definitions  (6 components, 6× parallel)
- UserModel, TeamModel, TaskModel, CommentModel  [data_model]
- DatabaseConfig                                 [tech_stack]
- DeploymentConfig                               [deployment]

## Wave 1: Foundation             (2 components, 2× parallel; deps: Wave 0)
- CacheService  [tech_stack, performance]
- AuthService   [auth]

## Wave 2: Services               (7 components, 7× parallel; deps: Wave 1)
- AuthMiddleware, TeamHandler, TaskListHandler, TaskCreateHandler,
  TaskUpdateHandler, TaskHandler, CommentHandler

═══ Part 3: Interface Contracts ══════════════════════════════════

### IAuthService
Owner: AuthService
Types: AuthCredentials, AuthToken, TokenPayload
\`\`\`
authenticate(credentials: AuthCredentials) -> AuthToken
validate_token(token: str) -> TokenPayload
authorize(user_id: str, permission: str) -> bool
\`\`\`
(plus IUserRepository, ITeamRepository, ITaskRepository,
 ICommentRepository, ICacheService — each with Owner, Types, methods)

═══ Part 4: Component Build Prompts ══════════════════════════════
(Execute in wave order. Components within a wave run in parallel.)

#### AuthService
Build a service component named \`AuthService\`.
Role / Purpose: Authentication and token management.

Constraints from the architecture spec:
- Method: JWT with RS256 signing
- Authorization: RBAC with roles owner, admin, member
- Session: access token 15m, refresh token 30d sliding

Must implement: IAuthService
Methods for IAuthService:
  - authenticate(credentials: AuthCredentials) -> AuthToken
  - validate_token(token: str) -> TokenPayload
  - authorize(user_id: str, permission: str) -> bool

#### AuthMiddleware
Build a middleware component named \`AuthMiddleware\`.
Role / Purpose: Request authentication and authorization middleware.

Depends on (import, do not implement): IAuthService
Constraints: (same auth constraints as above)

… one prompt per component, all 15 in this build package.` },

  { id: 's5', type: 'component', title: "The Build Agent's Pipeline",
    component: 'BuildFlow' },

  { id: 's6', type: 'image', title: 'The Build UI in Action',
    image: buildUiImg,
    caption: 'Live screenshot: 4 components built across 2 waves in 32.9s on local Ollama gemma3:12b. Wave 0 (weather-service, health-handler) ran in parallel; Wave 1 (weather-handler, app-server) followed. "Continue to Deploy →" appears when complete.' },

  { id: 's7', type: 'component', title: 'The Deploy Agent\'s Pipeline',
    component: 'DeployFlow' },

  { id: 's8', type: 'image', title: 'The Deploy UI in Action',
    image: deployUiImg,
    caption: 'Live screenshot: rendered fubo Application manifest for the "Quote of the Day" app (run d9331c480953) in Monaco editor, "Will deploy to" card showing the target URL with copy button, three sequential action buttons, and a custom-template upload card on the right.' },

  { id: 's8b', type: 'image', title: 'The Real Handoff',
    image: deployManualApplyImg,
    caption: 'This agent host has no kubectl, so instead of applying directly, it hands back the exact rendered YAML and a copy-pasteable apply command. For this split-host setup — agent and cluster access on different machines — that\'s the correct, by-design outcome, not a failure.' },

  { id: 's8c', type: 'image', title: 'The Real Result',
    image: quoteAppLiveImg,
    caption: 'The pod really is live and responding — a real HTTP 200 from the deployed container. The response itself is a generic placeholder (`{"result":"value"}`), not an actual quote: the LLM-generated /quote handler for this run was a functional stub rather than a fully realized feature. That\'s an honest, unedited limitation of this specific build, not a deployment failure.' },

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

const COMPONENTS = { WaveGridReplay, PipelineFlow, BuildFlow, DeployFlow, Assessment, DeploymentStack };

function markPartComplete() {
  try {
    const raw = localStorage.getItem('llm_course_progress')
    const progress = raw ? JSON.parse(raw) : {}
    progress.__v = 2
    progress.part4 = true
    localStorage.setItem('llm_course_progress', JSON.stringify(progress))
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export default function App() {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  useEffect(() => {
    const isLastSlide = idx === SLIDES.length - 1;
    window.__LLM_AT_LAST_SLIDE__ = isLastSlide;
    if (isLastSlide) {
      window.__LLM_MODULE_LAST_SLIDE__ = true;
      markPartComplete();
    }
  }, [idx]);

  const renderBody = () => {
    if (slide.type === 'component') {
      const Comp = COMPONENTS[slide.component];
      return <Comp />;
    }
    if (slide.type === 'assessment') {
      const Comp = COMPONENTS['Assessment'];
      return <Comp />;
    }
    if (slide.type === 'image') {
      return (
        <div className="image-slide">
          <img src={slide.image} alt={slide.title} />
          {slide.caption && <p className="caption">{slide.caption}</p>}
        </div>
      );
    }
    if (slide.type === 'codeblock') {
      return (
        <div className="codeblock-slide">
          {slide.intro && <p className="intro">{slide.intro}</p>}
          <pre className="code">{slide.code}</pre>
        </div>
      );
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
        <button disabled={idx === SLIDES.length - 1} onClick={() => {
          const next = idx + 1
          setIdx(next)
          if (next === SLIDES.length - 1) {
            markPartComplete()
            window.__LLM_AT_LAST_SLIDE__ = true
          }
        }}>Next</button>
      </footer>
    </div>
  );
}
