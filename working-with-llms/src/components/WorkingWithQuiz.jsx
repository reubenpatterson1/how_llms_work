import { useState, useMemo } from "react";

const C = {
  bg: "#0B1120", surface: "#131B2E", border: "#1E293B",
  text: "#E2E8F0", textDim: "#94A3B8", accent: "#3B82F6",
  green: "#22C55E", red: "#EF4444", yellow: "#EAB308",
};

const SECTIONS = [
  { name: "Density Principle", icon: "◈" },
  { name: "Channel Architecture", icon: "⊞" },
  { name: "Hallucination Mechanics", icon: "◉" },
  { name: "Consistency & Predictability", icon: "△" },
  { name: "Agentic Systems", icon: "⬡" },
  { name: "Applied Methodology", icon: "⊗" },
];

const QUESTIONS = [
  // Section 0: Density Principle
  {
    section: 0,
    q: `A product manager writes: "Build an e-commerce site with some kind of payment processing and a basic admin panel." An engineer rewrites it as: "Stripe payment integration with PCI-DSS compliance, admin RBAC with audit logging, PostgreSQL 15." Which statement best explains WHY the rewrite improves LLM output quality?`,
    options: [
      `The rewrite is shorter, reducing token count and therefore attention dilution`,
      `The rewrite resolves architectural dimensions that the model would otherwise fill from training defaults, converting hallucination vectors into grounded constraints`,
      `The rewrite uses technical jargon that the model was trained on more frequently`,
      `The rewrite specifies brand names which are easier for the model to pattern-match`,
    ],
    answer: 1,
    explanation: `Each vague term ("some kind of", "basic") leaves a dimension unresolved. The model must fill unresolved dimensions from training data — that's confabulation. The rewrite resolves payment (Stripe + PCI-DSS), admin (RBAC + audit logging), and database (PostgreSQL 15) dimensions, eliminating three hallucination vectors. Length isn't the issue — density of resolved dimensions is.`,
  },
  {
    section: 0,
    q: `A prompt achieves 0.85 density score with 10 channels. Two channels — Error Handling and Testing — remain at 0% resolution. What is the most likely impact on the generated code?`,
    options: [
      `The code will fail to compile because error handling is missing`,
      `The model will generate correct error handling and testing based on the other 8 resolved channels`,
      `The model will default to its training distribution for error handling and testing — likely try/catch with console.log and no tests`,
      `The 85% density is sufficient; the remaining 15% has negligible impact on output quality`,
    ],
    answer: 2,
    explanation: `Unresolved channels don't cause compilation errors or get inferred from other channels — they get filled from training data defaults. For error handling, that typically means generic try/catch with console.log. For testing, the model often omits tests entirely or generates trivial ones. The 0% channels are independent hallucination vectors regardless of overall density.`,
  },
  {
    section: 0,
    q: `Two prompts produce the same functional output. Prompt A is 200 tokens at 0.6 density. Prompt B is 400 tokens at 0.9 density. Which produces more reliable LLM output and why?`,
    options: [
      `Prompt A — shorter prompts always produce better results due to less attention dilution`,
      `Prompt B — more tokens means more information for the model to work with`,
      `Prompt B — the higher density score means more dimensions are resolved, reducing the confabulation surface regardless of token count`,
      `They produce equivalent output since both achieve the same functional result`,
    ],
    answer: 2,
    explanation: `Density score measures resolved dimensions / total dimensions, not token efficiency. Prompt B resolves 90% of dimensions vs 60%, meaning the model confabulates on 10% vs 40% of its decisions. The additional 200 tokens in Prompt B are constraint-oriented tokens that resolve dimensions — they earn their place. Attention dilution from extra tokens is far outweighed by the reduction in confabulation surface.`,
  },

  // Section 1: Channel Architecture
  {
    section: 1,
    q: `An architect resolves all tech stack and API channels to 95%+ but leaves Auth at 0%. The generated code uses Express with PostgreSQL and proper REST endpoints. What will happen in the auth layer?`,
    options: [
      `The model will skip authentication entirely since it wasn't specified`,
      `The model will generate auth that's consistent with the Express/PostgreSQL stack — likely Passport.js with sessions`,
      `The model will randomly choose between JWT, OAuth, sessions, or API keys — each run may differ`,
      `The model will likely default to its most common training pattern for the stack (e.g., JWT with basic middleware), but the specific implementation will vary across runs`,
    ],
    answer: 3,
    explanation: `With 0% auth resolution, the model fills from training defaults. For Express + PostgreSQL, JWT middleware is the most common training pattern, but the implementation details (secret management, token expiry, refresh strategy, role model) are all unresolved sub-dimensions. This means the general approach may be consistent but specifics will vary — sometimes RS256, sometimes HS256; sometimes 1-hour tokens, sometimes 24-hour. Each unresolved sub-dimension is an independent hallucination vector.`,
  },
  {
    section: 1,
    q: `The Architecture Agent asks about Data Model before API endpoints. A developer argues the questions should be reversed because "you need to know the endpoints to design the data model." Why does the agent's ordering make more sense for LLM output quality?`,
    options: [
      `Data Model resolution is alphabetically first in the channel registry`,
      `Entities and relationships constrain endpoint design — resolving them first means API questions can reference concrete entities, producing tighter constraints`,
      `The model processes tokens left-to-right, so data model tokens earlier in the prompt get more attention`,
      `It doesn't matter — channel ordering has no effect on the generated output`,
    ],
    answer: 1,
    explanation: `Channel ordering follows dependency logic: entities and relationships constrain what endpoints can exist. If you know you have User, Team, and Task with specific cardinalities, the API questions can be precise: "What operations on Tasks? Can a non-team-member view tasks?" Without the data model, API questions produce vague answers like "standard CRUD" — which is exactly the kind of unresolved dimension that creates hallucination surface.`,
  },
  {
    section: 1,
    q: `A channel has 5 sub-dimensions. Three are at 0.9 resolution and two are at 0.0. The channel's overall resolution shows 0.54. Should the agent move to another channel or continue with this one?`,
    options: [
      `Move on — 0.54 is close enough to the 0.8 threshold`,
      `Continue — the two 0.0 sub-dimensions are independent hallucination vectors that won't be resolved by other channels`,
      `Move on — the three high-resolution sub-dimensions will compensate for the low ones`,
      `Continue — but only because the agent always finishes one channel completely before moving to the next`,
    ],
    answer: 1,
    explanation: `Sub-dimensions at 0.0 are complete hallucination vectors — the model has zero constraint signal for those dimensions. High resolution on sibling sub-dimensions doesn't compensate because each sub-dimension maps to an independent decision the model must make. If "indexes" is at 0.0, the model will invent an index strategy regardless of how well "entities" is resolved. The agent correctly targets the lowest-resolution channel, and within it, the lowest sub-dimensions.`,
  },

  // Section 2: Hallucination Mechanics
  {
    section: 2,
    q: `A vague prompt generates code that uses MongoDB. The correct spec requires PostgreSQL. An engineer says "it hallucinated MongoDB." Technically, what classification best describes this token?`,
    options: [
      `Confabulated — the model invented MongoDB from training defaults because the database dimension was unresolved`,
      `Defaulted — MongoDB is a reasonable default, not a hallucination`,
      `Inferred — the model reasonably deduced MongoDB from the tech stack context`,
      `Grounded — MongoDB is a real database, so the token is grounded in reality`,
    ],
    answer: 0,
    explanation: `The grounding taxonomy classifies tokens by their relationship to the specification, not to reality. "Grounded" means derived from the spec. "Defaulted" means a common pattern applied without spec basis. "Confabulated" means invented to fill an unresolved dimension. Since the database dimension was unresolved and MongoDB was chosen from training data (it's the most common database in Express tutorials), this is confabulation. Note: defaulted and confabulated are both ungrounded, but confabulated implies a specific decision was made where none was specified.`,
  },
  {
    section: 2,
    q: `In our test data using Claude Sonnet via the Architecture Agent, the vague prompt produced 37.5% confabulated tokens and the dense spec produced 0%. A skeptic argues this only works with one model. Is the metric still meaningful?`,
    options: [
      `No — results from Claude Sonnet can't predict behavior on other models`,
      `Yes — the metric measures the STRUCTURAL property that unresolved dimensions force confabulation, which holds regardless of model complexity`,
      `Partially — the 37.5% number is unreliable but the 0% is meaningful`,
      `No — other models would produce lower hallucination rates due to RLHF alignment`,
    ],
    answer: 1,
    explanation: `The confabulation rate is a structural property of the prompt's density, not of the model's capability. A different model might confabulate different values (maybe FastAPI instead of Express), but it still must fill unresolved dimensions. The Claude Sonnet results demonstrate the principle: vague prompts have N unresolved dimensions that produce N confabulated decisions. Dense specs have 0 unresolved dimensions that produce 0 confabulated decisions. RLHF doesn't help here — alignment makes the model more helpful, not more constrained. A helpful model fills gaps enthusiastically.`,
  },
  {
    section: 2,
    q: `Generated code includes "port 3000" when no port was specified. Is this a hallucination, and what's the practical impact?`,
    options: [
      `Not a hallucination — port 3000 is the standard Express default`,
      `A minor hallucination with no practical impact — the port can be changed later`,
      `A defaulted token that exposes a configuration dimension the spec should have resolved — in production, this could conflict with other services or violate infrastructure policies`,
      `A confabulated token that proves the model is unreliable`,
    ],
    answer: 2,
    explanation: `Port 3000 is "defaulted" — it comes from the model's training distribution (Express tutorials overwhelmingly use 3000). While technically functional, it reveals an unresolved dimension: the deployment channel didn't specify port allocation. In production, this matters: port conflicts, firewall rules, load balancer configs, and Kubernetes service definitions all depend on the port. The real problem isn't port 3000 itself — it's that the model is making infrastructure decisions the architect didn't specify.`,
  },

  // Section 3: Consistency & Predictability
  {
    section: 3,
    q: `Five runs of a vague prompt produce: Express+MongoDB, Express+PostgreSQL, FastAPI+SQLite, Hono+Drizzle, Express+MongoDB. What Jaccard similarity pattern would you expect for the "Framework" dimension?`,
    options: [
      `100% — Express appears in 3/5 runs which is a majority`,
      `Low (~30-40%) — three different frameworks across 5 runs means significant pairwise disagreement`,
      `0% — no single framework appears in all runs`,
      `High (~80%) — Express is the dominant choice`,
    ],
    answer: 1,
    explanation: `Jaccard similarity is computed pairwise: intersection/union. With Express in runs 1,2,5 and FastAPI in 3, Hono in 4, the pairs (1,2), (1,5), (2,5) agree on Express (J=1.0) but all other pairs disagree (J=0.0 for framework). Average pairwise: 3 agreeing pairs out of 10 total = 0.3. The majority vote for Express masks the instability — a 60% hit rate means 40% of deployments would use the wrong framework. This is why consistency must be measured across ALL runs, not just the mode.`,
  },
  {
    section: 3,
    q: `A team implements a "5-run consistency gate" in CI. The gate passes if Jaccard similarity exceeds 95%. What does a gate failure tell the team?`,
    options: [
      `The model is broken and needs to be retrained`,
      `The prompt has unresolved dimensions that the model is filling stochastically — the team needs to add more constraints`,
      `The CI environment is introducing randomness — they should fix the seed`,
      `The model needs higher temperature to produce more consistent output`,
    ],
    answer: 1,
    explanation: `A consistency gate failure means architectural decisions vary across runs. Since the model is deterministic for fully-resolved dimensions, variance comes from unresolved dimensions where the model samples from its training distribution. The fix is to identify WHICH dimensions are varying (the consistency grid shows this) and resolve them in the spec. Retraining is unnecessary — the model isn't wrong, it's underspecified. Temperature 0 helps but doesn't eliminate variance from fundamentally ambiguous prompts.`,
  },
  {
    section: 3,
    q: `Dense spec produces identical output across 5 runs (100% consistency). Does this guarantee the output is correct?`,
    options: [
      `Yes — 100% consistency means the model is executing the spec exactly`,
      `No — consistency measures reproducibility, not correctness. A spec with wrong constraints produces consistently wrong output`,
      `Yes — the density methodology ensures specs are always correct`,
      `No — but the probability of correctness increases with consistency`,
    ],
    answer: 1,
    explanation: `Consistency and correctness are orthogonal properties. A spec that says "Database: SQLite" will consistently produce SQLite code — even if the actual requirement is PostgreSQL. Consistency eliminates stochastic variance, making output predictable and testable. But the spec itself must be validated against requirements. This is why the Architecture Agent includes ambiguity detection: catching "some kind of" and "maybe" prevents wrong constraints from entering the spec as confidently as missing constraints.`,
  },

  // Section 4: Agentic Systems
  {
    section: 4,
    q: `An agentic pipeline has 3 steps: (1) generate API schema, (2) generate database migrations, (3) generate test suite. Step 1 confabulates "email" as a required field on the User model. What happens downstream?`,
    options: [
      `Steps 2 and 3 will ignore the confabulated field since they have their own prompts`,
      `Step 2 creates a migration with a NOT NULL email column, Step 3 generates tests that assert email presence — the confabulation compounds through the pipeline, becoming "grounded" in downstream steps`,
      `The pipeline will detect the inconsistency and self-correct`,
      `Steps 2 and 3 may or may not include the email field — it's random`,
    ],
    answer: 1,
    explanation: `This is confabulation compounding. Step 1's ungrounded "email" field becomes input to Step 2, which treats it as a grounded constraint and generates a migration. Step 3 sees both the schema and migration agreeing on "email" and generates tests that validate it. By Step 3, the confabulated field has three layers of apparent validation — it looks intentional. This is why monitoring must classify grounding at EVERY step, not just the final output. An agentic system is only as grounded as its least-specified step.`,
  },
  {
    section: 4,
    q: `A team builds a code review agent that runs on every PR. It consistently flags "missing error handling" even when the PR intentionally delegates errors to a global middleware. What pillar failure does this represent?`,
    options: [
      `Monitoring failure — the agent's decisions aren't being logged`,
      `Configurability failure — the agent can't be told about the project's error handling architecture, so it defaults to its training pattern of per-function try/catch`,
      `Predictability failure — the agent should produce different results each time`,
      `This isn't a failure — the agent is correctly identifying missing error handling`,
    ],
    answer: 1,
    explanation: `The agent's prompt doesn't include the project's error handling architecture as a constraint. Without "Error handling: global middleware pattern with express-async-errors" in its context, the Error Handling channel is unresolved. The model fills it from training defaults: per-function try/catch is the dominant pattern in tutorials. This is a configurability failure — the team can't adjust the agent's behavior without modifying code. The fix: externalize the project's architectural constraints as configuration that the agent's prompt loads dynamically.`,
  },
  {
    section: 4,
    q: `An agentic deployment pipeline uses LLM-generated Kubernetes manifests. The monitoring dashboard shows 98% grounded tokens. Should the team trust this metric?`,
    options: [
      `Yes — 98% grounding is excellent and indicates high-quality output`,
      `Yes — Kubernetes manifests are well-structured, making grounding easy to verify`,
      `No — the 2% ungrounded tokens could be in critical fields like resource limits, security contexts, or image tags, where a single confabulated value can cause production incidents`,
      `No — grounding percentages are unreliable for infrastructure code`,
    ],
    answer: 2,
    explanation: `Aggregate grounding percentages hide risk concentration. In a 500-token Kubernetes manifest, 2% = 10 tokens. If those 10 tokens are whitespace or comments, the risk is zero. If they're resource limits (confabulated "256Mi" when the service needs "4Gi"), security contexts (confabulated "privileged: true"), or image tags (confabulated "latest" instead of the pinned SHA), a single token can cause an outage. Monitoring must weight grounding by token criticality, not just count. Infrastructure tokens that affect runtime behavior need 100% grounding.`,
  },

  // Section 5: Applied Methodology
  {
    section: 5,
    q: `You're architecting a real-time collaborative document editor. The Architecture Agent resolves 9/10 channels to 90%+ but Performance remains at 20%. The team says "we'll optimize later." What is the correct response?`,
    options: [
      `Agree — performance optimization is typically done after initial implementation`,
      `Disagree — the Performance channel's unresolved sub-dimensions (latency targets, throughput, pagination, optimization strategy) will cause the LLM to confabulate performance-critical decisions like WebSocket buffer sizes, conflict resolution timing, and operational transform batch sizes`,
      `Agree — 9/10 channels resolved is sufficient for a first pass`,
      `Disagree — but only because performance should have been resolved first, not last`,
    ],
    answer: 1,
    explanation: `For a collaborative editor, Performance sub-dimensions directly impact architecture: WebSocket message batching (affects latency), operational transform strategy (affects consistency), presence timeout intervals (affects UX), conflict resolution timing (affects data integrity). With these at 0% resolution, the model invents values from training data — likely defaults from tutorial-scale examples (100ms polling, no batching, simple last-write-wins). These defaults don't just need optimization later — they need architectural replacement. Resolving performance constraints upfront prevents confabulation of decisions that are expensive to change.`,
  },
  {
    section: 5,
    q: `A junior engineer asks: "If the Architecture Agent catches vague requirements, why not just train the LLM to ask clarifying questions itself?" What is the fundamental flaw in this reasoning?`,
    options: [
      `LLMs can't ask clarifying questions — they can only generate text`,
      `The LLM asking questions would use an unresolved "how to ask questions" dimension, leading to inconsistent and potentially misleading clarification requests — you'd be using a confabulation-prone system to prevent confabulation`,
      `LLMs don't have memory, so they can't track which dimensions are resolved`,
      `It would be too slow — the Architecture Agent is faster than an LLM`,
    ],
    answer: 1,
    explanation: `The Architecture Agent's question-targeting logic is deterministic: find lowest-resolution channel, select appropriate template, update resolution on response. If you delegate this to an LLM, the "how to ask questions" dimension is itself unresolved — the model must decide which questions to ask, in what order, with what follow-ups, based on its training data. Different runs would ask different questions, miss different dimensions, and produce different specs. You'd be bootstrapping a density-maximization system on a system that itself suffers from density problems. The agent's deterministic intake logic is the foundation precisely because it doesn't depend on the model.`,
  },
  {
    section: 5,
    q: `Your team generates a Dense Architecture Specification and produces code. The code works but a code reviewer identifies that the generated database schema uses VARCHAR(255) for all string fields. The spec said "String" without length constraints. What lesson does this illustrate?`,
    options: [
      `The model made an error — VARCHAR(255) is wrong for most fields`,
      `The spec generator needs to add default string lengths automatically`,
      `The Data Model channel's "constraints" sub-dimension was partially resolved — "String" is a type constraint but not a length constraint. VARCHAR(255) is the model's training default for unspecified string lengths. The lesson: resolution is not binary — sub-dimensions can be partially resolved, and partial resolution produces partially confabulated output`,
      `This is acceptable — VARCHAR(255) is the industry standard for string fields`,
    ],
    answer: 2,
    explanation: `This illustrates that resolution exists on a spectrum, not as a binary. The spec resolved the TYPE (String) but not the CONSTRAINT (length). The model filled the gap with its training default: VARCHAR(255), which comes from MySQL tutorial conventions. For an email field, VARCHAR(255) is fine. For a task description, it's truncation-prone. For a status enum, it's wasteful. Each field needs its own length constraint — "title VARCHAR(200) NOT NULL", "status VARCHAR(20) CHECK IN ('todo','done')". Partial resolution produces partially confabulated output — the dangerous kind that looks correct but isn't fully specified.`,
  },
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function IntroScreen({ onStart, name, setName }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 40px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⊗</div>
      <h2 style={{ color: C.text, fontSize: 28, marginBottom: 8 }}>Engineering Professional Assessment</h2>
      <p style={{ color: C.accent, fontSize: 16, marginBottom: 24 }}>Applied LLM Architecture</p>
      <p style={{ color: C.textDim, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        18 questions across 6 sections testing your ability to apply density methodology,
        diagnose hallucination vectors, and design stable agentic systems.
        Pass threshold: 13/18 (72%).
      </p>
      <input value={name} onChange={e => setName(e.target.value)}
        placeholder="Your name (for certificate)"
        style={{ width: "100%", maxWidth: 300, padding: "10px 14px", background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 14,
          marginBottom: 16, outline: "none", textAlign: "center" }}
      />
      <br />
      <button onClick={onStart} disabled={!name.trim()}
        style={{ background: C.accent, color: "#fff", border: "none", padding: "12px 32px",
          borderRadius: 6, fontSize: 15, cursor: name.trim() ? "pointer" : "default",
          opacity: name.trim() ? 1 : 0.5 }}>
        Begin Assessment
      </button>
    </div>
  );
}

function SectionHeader({ section }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 40px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{section.icon}</div>
      <h2 style={{ color: C.text, fontSize: 24 }}>Section: {section.name}</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginTop: 8 }}>3 questions</p>
    </div>
  );
}

function QuestionScreen({ q, qNum, total, selected, setSelected, revealed, onReveal, onNext }) {
  return (
    <div style={{ maxWidth: 750, margin: "0 auto", padding: "20px 30px" }}>
      <div style={{ color: C.textDim, fontSize: 12, marginBottom: 8 }}>
        Question {qNum} of {total}
      </div>
      <p style={{ color: C.text, fontSize: 16, lineHeight: 1.6, marginBottom: 20 }}>{q.q}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {q.options.map((opt, i) => {
          let bg = C.surface;
          let borderColor = C.border;
          if (revealed) {
            if (i === q.answer) { bg = `${C.green}15`; borderColor = C.green; }
            else if (i === selected && i !== q.answer) { bg = `${C.red}15`; borderColor = C.red; }
          } else if (i === selected) {
            bg = `${C.accent}15`; borderColor = C.accent;
          }

          return (
            <div key={i} onClick={() => !revealed && setSelected(i)}
              style={{
                background: bg, border: `1px solid ${borderColor}`, borderRadius: 6,
                padding: "12px 16px", cursor: revealed ? "default" : "pointer",
                transition: "all 0.2s",
              }}>
              <span style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>{opt}</span>
            </div>
          );
        })}
      </div>

      {!revealed && selected !== null && (
        <button onClick={onReveal}
          style={{ background: C.accent, color: "#fff", border: "none", padding: "10px 24px",
            borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
          Reveal Answer
        </button>
      )}

      {revealed && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            background: selected === q.answer ? `${C.green}10` : `${C.red}10`,
            border: `1px solid ${selected === q.answer ? C.green : C.red}33`,
            borderRadius: 6, padding: "12px 16px", marginBottom: 16,
          }}>
            <p style={{ color: selected === q.answer ? C.green : C.red, fontSize: 13, margin: "0 0 4px",
              fontWeight: 600 }}>
              {selected === q.answer ? "Correct!" : "Incorrect"}
            </p>
            <p style={{ color: C.textDim, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {q.explanation}
            </p>
          </div>
          <button onClick={onNext}
            style={{ background: C.accent, color: "#fff", border: "none", padding: "10px 24px",
              borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

async function downloadCertPDF({ title, subtitle, name, body, fields, watermark = "LLM ENGINEERING COURSE" }) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, H, "F");
  doc.setTextColor(30, 41, 59); doc.setFontSize(28); doc.setFont("helvetica", "bold");
  for (let y = -50; y < H + 50; y += 40) for (let x = -100; x < W + 100; x += 160) doc.text(watermark, x, y, { angle: 30 });
  doc.setDrawColor(232, 168, 56); doc.setLineWidth(0.5); doc.rect(12, 12, W - 24, H - 24); doc.rect(15, 15, W - 30, H - 30);
  const cLen = 8;
  [[18,18,1,1],[W-18,18,-1,1],[18,H-18,1,-1],[W-18,H-18,-1,-1]].forEach(([x,y,dx,dy]) => { doc.line(x,y,x+cLen*dx,y); doc.line(x,y,x,y+cLen*dy); });
  doc.setTextColor(232, 168, 56); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), W/2, 38, { align: "center" });
  doc.setTextColor(138, 150, 167); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(subtitle.toUpperCase(), W/2, 45, { align: "center" });
  doc.setTextColor(138, 150, 167); doc.setFontSize(10); doc.text("This certifies that", W/2, 60, { align: "center" });
  doc.setTextColor(226, 232, 240); doc.setFontSize(28); doc.setFont("helvetica", "bold");
  doc.text(name, W/2, 75, { align: "center" });
  doc.setDrawColor(232, 168, 56); doc.setLineWidth(0.3); doc.line(W/2-20, 82, W/2+20, 82);
  doc.setTextColor(138, 150, 167); doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(body, 180), W/2, 92, { align: "center", lineHeightFactor: 1.6 });
  const fieldY = 135, fieldSpacing = W / (fields.length + 1);
  fields.forEach((f, i) => { const x = fieldSpacing*(i+1);
    doc.setTextColor(74,85,104); doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.text(f.label.toUpperCase(), x, fieldY, { align: "center" });
    doc.setTextColor(226,232,240); doc.setFontSize(11); doc.text(f.value, x, fieldY+7, { align: "center" });
  });
  doc.setTextColor(50,60,80); doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text("This certificate was generated as part of the LLM Engineering Course", W/2, H-20, { align: "center" });
  doc.save(`${name.replace(/\s+/g, "_")}_Certificate.pdf`);
}

function Certificate({ name, score, total, sectionScores }) {
  const pct = Math.round((score / total) * 100);
  const passed = score >= 13;
  const tier = pct >= 93 ? "Distinction" : pct >= 72 ? "Pass" : "Below Threshold";
  const id = `WLLM-${hashCode(name + score)}-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 30px" }}>
      <div style={{
        background: C.surface, border: `2px solid ${passed ? C.green : C.red}`,
        borderRadius: 12, padding: "40px 32px", textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{passed ? "◈" : "△"}</div>
        <h2 style={{ color: C.text, fontSize: 24, marginBottom: 4 }}>
          {passed ? "Certificate of Completion" : "Assessment Result"}
        </h2>
        <p style={{ color: C.accent, fontSize: 14, marginBottom: 24 }}>
          Engineering Professional — Applied LLM Architecture
        </p>

        <p style={{ color: C.text, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{name}</p>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 24 }}>
          Score: {score}/{total} ({pct}%) — {tier}
        </p>

        {/* Section breakdown */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 12px", color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Section</th>
              <th style={{ textAlign: "right", padding: "6px 12px", color: C.textDim, fontSize: 12,
                borderBottom: `1px solid ${C.border}` }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((sec, i) => (
              <tr key={i}>
                <td style={{ padding: "6px 12px", color: C.text, fontSize: 13,
                  borderBottom: `1px solid ${C.border}` }}>
                  {sec.icon} {sec.name}
                </td>
                <td style={{ padding: "6px 12px", color: C.text, fontSize: 13, textAlign: "right",
                  borderBottom: `1px solid ${C.border}` }}>
                  {sectionScores[i]}/3
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ color: C.textDim, fontSize: 11 }}>Certificate ID: {id}</p>
        <p style={{ color: C.textDim, fontSize: 11 }}>
          How to Actually Work WITH LLMs — {new Date().toLocaleDateString()}
        </p>
      </div>

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button onClick={() => downloadCertPDF({
            title: "Certificate of Comprehension",
            subtitle: "Applied LLM Architecture",
            name,
            body: "has demonstrated engineering-level comprehension of constraint-oriented prompt architecture, 10-channel density methodology, comparative analysis, run-to-run consistency, and agentic system design for large language models.",
            fields: [
              { label: "Score", value: `${score} / ${total}` },
              { label: "Percentage", value: `${pct}%` },
              { label: "Result", value: tier },
              { label: "Date", value: new Date().toLocaleDateString() },
              { label: "Certificate ID", value: id },
            ],
          })}
          style={{ background: "none", color: C.textDim, border: `1px solid ${C.border}`,
            padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          Download PDF
        </button>
      </div>
    </div>
  );
}

export default function WorkingWithQuiz() {
  const [phase, setPhase] = useState("intro");
  const [name, setName] = useState("");
  const [seqIdx, setSeqIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const sequence = useMemo(() => {
    const seq = [];
    for (let s = 0; s < SECTIONS.length; s++) {
      seq.push({ type: "section", section: s });
      QUESTIONS.filter(q => q.section === s).forEach((q) => {
        const indices = q.options.map((_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        seq.push({
          type: "question",
          question: { ...q, options: indices.map(i => q.options[i]), answer: indices.indexOf(q.answer) },
          globalIdx: QUESTIONS.indexOf(q),
        });
      });
    }
    return seq;
  }, []);

  const current = sequence[seqIdx];

  const handleNext = () => {
    if (current?.type === "question" && selected !== null) {
      setAnswers(prev => ({ ...prev, [current.globalIdx]: selected }));
    }
    setSelected(null);
    setRevealed(false);
    if (seqIdx < sequence.length - 1) {
      setSeqIdx(seqIdx + 1);
    } else {
      setPhase("done");
    }
  };

  if (phase === "intro") {
    return <IntroScreen onStart={() => setPhase("sequence")} name={name} setName={setName} />;
  }

  if (phase === "done") {
    const questionSteps = sequence.filter(s => s.type === "question");
    const score = questionSteps.reduce((s, step) => s + (answers[step.globalIdx] === step.question.answer ? 1 : 0), 0);
    const sectionScores = SECTIONS.map((_, si) =>
      questionSteps.filter(step => step.question.section === si)
        .reduce((s, step) => s + (answers[step.globalIdx] === step.question.answer ? 1 : 0), 0)
    );
    return <Certificate name={name} score={score} total={QUESTIONS.length} sectionScores={sectionScores} />;
  }

  if (current.type === "section") {
    return (
      <div>
        <SectionHeader section={SECTIONS[current.section]} />
        <div style={{ textAlign: "center" }}>
          <button onClick={handleNext}
            style={{ background: C.accent, color: "#fff", border: "none", padding: "10px 24px",
              borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
            Start Section
          </button>
        </div>
      </div>
    );
  }

  const qNum = Object.keys(answers).length + 1;

  return (
    <QuestionScreen
      q={current.question}
      qNum={qNum}
      total={QUESTIONS.length}
      selected={selected}
      setSelected={setSelected}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      onNext={handleNext}
    />
  );
}
