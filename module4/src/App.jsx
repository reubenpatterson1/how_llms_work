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
import weatherAppLiveImg from './assets/screenshots/weather-app-live.png';
import './index.css';
import './App.css';

const SAMPLE_SPEC_HIGHLIGHT = `# Dense Architecture Specification
# Density Score: 0.436

## Purpose
# Resolution: 75.0%

- A weather page to retrieve current weather information.
- students trying a demo
- Success means real current weather for any valid city.
- single weather page plus the weather API and health check (in scope)
- login, accounts, saved data (out of scope for PoC)

## Data Model
# Resolution: 78.0%

- City Name (returned by OpenWeather), current temperature in °F, and weather description.
- No persistence required for the PoC phase

## API
# Resolution: 66.0%

- GET /api/weather?city= is the main endpoint.
- GET / serves the single-page HTML with a city input defaulting to New York and a 'Get weather' button.
- GET /healthz returns 200.
- Success response: JSON {"city": str, "temp_f": number, "description": str} with status 200.

## Tech Stack
# Resolution: 80.0%

- Python 3.12
- Flask
- Not required / out of scope (user marked N/A)
- Not required / out of scope (user marked N/A)
- Not required / out of scope (user marked N/A)

## Error Handling
# Resolution: 22.5%

- 400: {"error": "city is required"} if city is missing or empty.
- 404: {"error": "city not found"} when OpenWeather returns 404.
- 502: {"error": "weather service unavailable"} on any other upstream failure or a timeout.
- 500: {"error": "OPENWEATHER_API_KEY not set"} if the env var is absent.

## Security
# Resolution: 20.0%

- Config comes from the env var OPENWEATHER_API_KEY, which is never hard-coded
- The key must be read from os.environ only.`;

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
    intro: 'Worked example: a Hello World weather page. Type a city, and the page shows the current temperature in °F and the description from the OpenWeather API. Below is an excerpt of the real dense spec from run 5 (app app-bd56da), produced by the stock Architect intake on Ollama gemma4:e4b. Some lines and the Auth, Deployment, Performance and flat-constraint sections are left out. Read the spec before you decompose it, because intake says "ready" early: it announced "All channels resolved" at 78% density, but this spec scores 0.436 (44%) and still lists 9 unresolved channels. The spec also has real defects. requests is missing from Tech Stack. Three "Not required / out of scope (user marked N/A)" bullets were added that the user never marked. The API line lost its <name> and reads GET /api/weather?city=.',
    code: SAMPLE_SPEC_HIGHLIGHT },

  { id: 's4c', type: 'image', title: 'Decompose: Load the Spec',
    image: decomposeSpecLoadedImg,
    caption: 'The Decompose page picks up the spec from your intake session; the "using session" badge says so. You can instead upload or paste a spec.md from an earlier intake, and the badge then changes to "using upload". Check the phase selector before you click Run Decompose: in run 5 it showed MVP even though intake ran in PoC.' },

  { id: 's4d', type: 'image', title: 'Decompose Output: 9 Components, 2 Waves, 78% Time Saved',
    image: decomposeWavePlanImg,
    caption: 'Wave 0 has 7 components, all built in parallel: WeatherDataModel, WeatherService, HealthzHandler, APIConfig, ErrorHandlingMiddleware, RateLimitMiddleware and WeatherTestSuite. Wave 1 has 2 components, WeatherHandler and RootPageHandler, and they wait for Wave 0. The dependency graph on the right shows why: weather-handler depends on weather-service, error-middleware and rate-limit-middleware, and root-page-handler depends on error-middleware. Every component is rated medium (20 min), so the estimate is 180 min built one after another and 40 min built in waves. Read the plan before you build. Nobody asked for RateLimitMiddleware; decompose attached it to the 5s-timeout constraint. The second wave always gets the fixed label "Foundation (Models + Config)", so that label appears here even though this wave holds the handlers. The phase selector shows MVP even though intake ran in PoC.' },

  { id: 's4', type: 'codeblock', title: 'The Build Package That Comes Out',
    intro: 'The decompose run produces a build package, one YAML file (build-package-mvp.yaml, 209 lines for these 9 components). It has four parts: metadata (the numbers on the Decompose page), the spec again channel by channel, the rules, and a dag with one entry per component. Each entry holds the component\'s wave, its complexity, the constraints that apply to it, what it consumes, and the prompt the Build Agent will send. An excerpt is below. Two notes. The file says phase: mvp even though intake ran in PoC, because the Decompose page\'s phase selector showed MVP. And for Python builds the Build Agent removes the "Depends on (import, do not implement)" line: the app shell loads each generated file on its own, so one file cannot import another.',
    code: `# Build Package — YAML DAG Format
# Generated by Architecture Agent → Decomposition Agent

metadata:
  phase: mvp
  total_components: 9
  total_waves: 2
  max_parallelism: 7
  time_savings_percent: 78
  estimated_sequential_minutes: 180
  estimated_parallel_minutes: 40

spec:
  purpose:
    - "A weather page to retrieve current weather information."
    … (the dense spec again, channel by channel)
  api:
    - "GET /api/weather?city=<name> is the main endpoint."
    …

rules:
  - "Every architectural decision MUST trace to a constraint in spec"
  - "If a dimension has no constraint, ASK — do not invent"

dag:
  healthz-handler:
    name: HealthzHandler
    type: handler
    wave: 0
    complexity: medium
    constraints:
      - "GET /healthz returns 200."
    prompt: |
      Build a handler component named \`HealthzHandler\`.
      Purpose: Handles the GET /healthz endpoint to check service availability..

      Constraints from the architecture spec:
      - GET /healthz returns 200.

  weather-handler:
    name: WeatherHandler
    type: handler
    wave: 1
    complexity: medium
    consumes:
      - WeatherService
    constraints:
      - "Endpoint triggered by submitting a city name ('Get weather' button)."
      - …
    prompt: |
      Build a handler component named \`WeatherHandler\`.
      Purpose: Handles the GET /api/weather endpoint request, orchestrating data fetching and error responses..

      Constraints from the architecture spec:
      - Endpoint triggered by submitting a city name ('Get weather' button).
      - Success response: JSON {"city": str, "temp_f": number, "description": str} with status 200.

      Depends on (import, do not implement): WeatherService

… 9 entries in all: 7 in wave 0, 2 in wave 1.` },

  { id: 's5', type: 'component', title: "The Build Agent's Pipeline",
    component: 'BuildFlow' },

  { id: 's6', type: 'image', title: 'The Build UI in Action',
    image: buildUiImg,
    caption: 'Live screenshot (run 5): 9 components built across 2 waves in 105.8s on Ollama gemma4:e4b, every one on the first attempt. Wave 0\'s 7 components ran in parallel; the slowest was weather-data-model at 64.3s. Wave 1 (weather-handler 41.6s, root-page-handler 18.2s) started only after Wave 0 finished. When the build completes, exactly one "Continue to Deploy →" link appears. Results vary by run, and a build may need one rebuild: in run 4 a component was rejected and had to be retried. When any component fails, the Build page is coded to show a red failure banner and hide the Deploy link. One more stock-UI step: after Decompose, the Build page opens with "no source", so you upload the build package you downloaded.' },

  { id: 's7', type: 'component', title: 'The Deploy Agent\'s Pipeline',
    component: 'DeployFlow' },

  { id: 's8', type: 'image', title: 'The Deploy UI in Action',
    image: deployUiImg,
    caption: 'Live screenshot (run 5, bd56dacd8151): the stock Deploy page rendered the fubo Application manifest for app-bd56da. It shows image architect-builds/app:bd56da, containerPort 3000, healthcheck /healthz and host app-bd56da-training.tools.fubotv.net. The env block points OPENWEATHER_API_KEY at a secretKeyRef to the app\'s own Secret: name app-bd56da-openweather, key OPENWEATHER_API_KEY, optional: true. The YAML names the Secret and contains no key value. Because of optional: true, the pod starts even when the Secret is missing; the app just has no key. In this worked example the instructor created that Secret by hand, from a laptop (next slide). The Deploy page itself says nothing about the Secret before you apply; the reminder appears only in the handoff panel.' },

  { id: 's8b', type: 'image', title: 'The Real Handoff',
    image: deployManualApplyImg,
    caption: 'The agent host has no kubectl, so after Build Image and Push to ECR it stops at a "Manual apply needed" panel. You run everything on it from your laptop, in order, in one shell. (1) A hidden prompt reads your OpenWeather key and prints its length; expect len=32. (2) AWS_PROFILE=fubo-tools kubectl --context vat-dev -n training create secret generic app-bd56da-openweather creates the app\'s own Secret from that key. (3) The rendered YAML is piped into AWS_PROFILE=fubo-tools kubectl --context vat-dev apply -f -, and the YAML itself sets namespace: training. (4) curl -sS https://app-bd56da-training.tools.fubotv.net/healthz checks the app. The panel adds one warning: HTTPS only, because http:// returns a 404 from the shared load balancer. Each command sets the profile and context itself, so your default kubeconfig context does not matter. When the agent and cluster access are on different machines, this handoff is the expected result, not a failure.' },

  { id: 's8c', type: 'image', title: 'The Real Result: Live Weather, Checked Against OpenWeather',
    image: weatherAppLiveImg,
    caption: 'The live app at https://app-bd56da-training.tools.fubotv.net/. The page shows city, temperature in °F and description. This screenshot was taken later than the numbers below, so it shows 39.6 °F and "scattered clouds": the weather moved. A 200 only proves the pod is up, so the result was checked against OpenWeather directly. The app\'s GET /api/weather?city=Chicago returned 38.3 °F and "broken clouds". OpenWeather\'s own imperial reading was 38.08 °F, a difference of 0.22 °F. OpenWeather\'s description read "scattered clouds" because its data updated between the two calls, which were not made at the same moment. An unknown city returns 404 and a missing city returns 400. Results vary by run. In run 4 the model wrote page JavaScript that converted the already-Fahrenheit value a second time, so the page showed 12 °F while the API said 53.11, even though the pipeline and the page load both succeeded. Always check the page against the API.' },

  { id: 's9', type: 'text', title: 'What Gets Generated',
    body: 'Per component: one source file (.js or .py). Per project: package.json or requirements.txt, Dockerfile, .env.example, _package.yaml and an app.py shim. The build agent writes everything to a versioned workspace folder.' },

  { id: 's10', type: 'text', title: 'Payoff: Where OPENWEATHER_API_KEY Comes From',
    body: "The .env.example lists OPENWEATHER_API_KEY= with no value. Here is where the value comes from in the worked example.\n\n1. The code reads the key from the environment. The spec requires os.environ (\"The key must be read from os.environ only.\"), and the build rules tell every Python file to read environment variables at request time and never log, return or render a secret.\n2. .env.example, which Assemble writes for every build, documents the variable so a developer knows it exists.\n3. The value reaches the pod from the app's own cluster Secret, app-bd56da-openweather. The rendered YAML only names that Secret (secretKeyRef, key OPENWEATHER_API_KEY), so the key is never in the code, the image or the YAML.\n4. In this worked example the instructor created that Secret by hand, from a laptop, using the command in the Deploy panel. The instructor checked len=32 in the same shell first, because a Secret created from an unset variable is silently empty.\n\nThat Secret belongs to the instructor's app. In the follow-along it is replaced: each learner's app gets its own Secret holding the learner's own key." },

  { id: 's11', type: 'text', title: 'The Deploy Step',
    body: 'Take the deploy YAML template, fill in auto-derived fields (image, port, healthcheck path, ingress host), let the user customize the rest, then build → push → apply.' },

  { id: 's12', type: 'text', title: 'Anatomy of the Deploy YAML',
    body: 'fubo Application CRD: apiVersion app.smo.tools.fubotv.net/v1alpha1. Key fields: image, replicas, resources, ports, healthcheck (must match what your app actually serves), ingress host (must be unique).' },

  { id: 's13', type: 'text', title: 'Image Build & Push',
    body: 'docker build → docker tag → docker push to ECR. The ECR login token on the build host (12hr TTL) is refreshed by the operator (the instructor), not by the student. On auth error the agent surfaces the exact "aws ecr get-login-password" command.' },

  { id: 's14', type: 'text', title: 'Live URL',
    body: 'On this platform the apply is a manual step shown in the Deploy panel: run the shown commands on your laptop with AWS_PROFILE=fubo-tools and --context vat-dev. The "poll" button only works over https pages, so verify with the curl line instead of relying on ~90s polling.' },

  { id: 's15', type: 'text', title: 'Live Walkthrough',
    body: 'Switch to architect tool now → walk Stages 1-3 with the HelloWorld spec.' },

  { id: 's16', type: 'text', title: "What This Doesn't Cover",
    body: 'No automated tests run as part of the build. No deploy-config validation. No health-monitoring dashboards. No rollback or blue-green. All of that is Module 5: Testing & CI/CD.' },

  { id: 's17', type: 'text', title: 'Recap',
    body: 'Four stages: Spec → Decompose → Build → Deploy. Four artifacts: dense spec, build-package YAML, container image, live URL. The agent is yours to run on your own apps now.' },

  { id: 's18', type: 'assessment', title: 'Assessment',
    body: '15 MCQ across 3 sections: Decompose & Wave Planning, The Build Agent, Deploy Agent & K8s Reconcile. Pass threshold 11/15. Certificate on pass.' },
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
