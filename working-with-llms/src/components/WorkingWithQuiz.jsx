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
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
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
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, H, "F");
  // Watermark (tiled logo, very light)
  var wmData = "data:image/png;base64,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";
  var wmW = 40, wmH = 25;
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({opacity: 0.06}));
  for (var wy = 5; wy < H; wy += 35) {
    for (var wx = 5; wx < W; wx += 55) {
      doc.addImage(wmData, "PNG", wx, wy, wmW, wmH);
    }
  }
  doc.restoreGraphicsState();
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
