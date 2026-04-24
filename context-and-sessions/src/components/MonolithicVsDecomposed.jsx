import { useState } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'

const LEVELS = ['Simple', 'Moderate', 'Complex', 'Enterprise']

// All metrics are illustrative; chosen so Vibe degrades super-linearly
// with complexity while Engineered stays roughly flat.
const DATA = {
  Simple: {
    vibe:       { contextTok: 15000,  effectiveTok: 15000,  constraintRecall: 0.95, hallucinations: 0, wallClockMin: 30,  quality: 90 },
    engineered: { contextTokPerAgent: 16000, effectiveTokPerAgent: 14000, constraintRecall: 0.97, hallucinations: 0, wallClockMin: 20,  quality: 92, agents: 3 },
  },
  Moderate: {
    vibe:       { contextTok: 45000,  effectiveTok: 28000,  constraintRecall: 0.65, hallucinations: 3, wallClockMin: 120, quality: 65 },
    engineered: { contextTokPerAgent: 16000, effectiveTokPerAgent: 14000, constraintRecall: 0.96, hallucinations: 0, wallClockMin: 40,  quality: 91, agents: 6 },
  },
  Complex: {
    vibe:       { contextTok: 90000,  effectiveTok: 45000,  constraintRecall: 0.30, hallucinations: 8, wallClockMin: 360, quality: 35 },
    engineered: { contextTokPerAgent: 16000, effectiveTokPerAgent: 14000, constraintRecall: 0.95, hallucinations: 0, wallClockMin: 60,  quality: 90, agents: 10 },
  },
  Enterprise: {
    vibe:       { contextTok: 180000, effectiveTok: 55000,  constraintRecall: 0.12, hallucinations: 15, wallClockMin: 960, quality: 18 },
    engineered: { contextTokPerAgent: 16000, effectiveTokPerAgent: 14000, constraintRecall: 0.94, hallucinations: 0, wallClockMin: 120, quality: 89, agents: 16 },
  },
}

const OUTPUT_SAMPLES = {
  Simple: {
    vibe: [
      { text: 'Next.js 14 app router', hallucinated: false },
      { text: 'PostgreSQL 15', hallucinated: false },
      { text: 'Stripe checkout', hallucinated: false },
    ],
    engineered: [
      { text: 'Next.js 14 app router', hallucinated: false },
      { text: 'PostgreSQL 15', hallucinated: false },
      { text: 'Stripe checkout', hallucinated: false },
    ],
  },
  Moderate: {
    vibe: [
      { text: 'Next.js 14 app router', hallucinated: false },
      { text: 'PostgreSQL 14', hallucinated: true, shouldBe: 'PostgreSQL 15' },
      { text: 'Stripe checkout (no webhook idempotency)', hallucinated: true, shouldBe: 'Stripe webhook idempotency per spec' },
      { text: 'VARCHAR(255) for all fields', hallucinated: true, shouldBe: 'length per field from spec' },
    ],
    engineered: [
      { text: 'Next.js 14 app router', hallucinated: false },
      { text: 'PostgreSQL 15', hallucinated: false },
      { text: 'Stripe webhook with idempotency', hallucinated: false },
      { text: 'Schema lengths from spec', hallucinated: false },
    ],
  },
  Complex: {
    vibe: [
      { text: 'Next.js 14 app router', hallucinated: false },
      { text: 'PostgreSQL 14', hallucinated: true, shouldBe: 'PostgreSQL 15' },
      { text: 'Stripe (retries unclear)', hallucinated: true, shouldBe: 'Stripe w/ idempotency' },
      { text: 'JWT HS256', hallucinated: true, shouldBe: 'JWT RS256 per security spec' },
      { text: '30-day retention', hallucinated: true, shouldBe: '90-day retention (HARD)' },
      { text: 'Custom ACL code', hallucinated: true, shouldBe: 'Casbin RBAC per spec' },
      { text: 'Express server', hallucinated: true, shouldBe: 'Hono server per spec' },
      { text: 'Missing WCAG-AA pass', hallucinated: true, shouldBe: 'WCAG-AA accessibility required' },
      { text: 'LCP not measured', hallucinated: true, shouldBe: 'LCP < 2s required' },
    ],
    engineered: [
      { text: 'Next.js 14 app router', hallucinated: false },
      { text: 'PostgreSQL 15', hallucinated: false },
      { text: 'Stripe w/ idempotency', hallucinated: false },
      { text: 'JWT RS256', hallucinated: false },
      { text: '90-day retention', hallucinated: false },
      { text: 'Casbin RBAC', hallucinated: false },
      { text: 'Hono server', hallucinated: false },
      { text: 'WCAG-AA verified', hallucinated: false },
      { text: 'LCP < 2s verified', hallucinated: false },
    ],
  },
  Enterprise: {
    vibe: [
      { text: 'PostgreSQL 14', hallucinated: true, shouldBe: 'PostgreSQL 15' },
      { text: 'JWT HS256', hallucinated: true, shouldBe: 'JWT RS256' },
      { text: '30-day retention', hallucinated: true, shouldBe: '90-day retention (HARD)' },
      { text: 'No compliance indexing', hallucinated: true, shouldBe: 'SOC2 index required' },
      { text: 'No PII guardrail', hallucinated: true, shouldBe: 'PII redaction required' },
      { text: 'Express + raw SQL', hallucinated: true, shouldBe: 'Hono + Drizzle' },
      { text: 'Missing i18n', hallucinated: true, shouldBe: 'i18n required for EU ship' },
      { text: 'Client-side payment totals', hallucinated: true, shouldBe: 'Server-authoritative totals' },
      { text: 'Basic logging', hallucinated: true, shouldBe: 'OTEL traces required' },
      { text: 'No rate limiting', hallucinated: true, shouldBe: 'Per-tenant rate limits' },
      { text: 'Custom CSRF', hallucinated: true, shouldBe: 'Framework CSRF' },
      { text: 'No feature flags', hallucinated: true, shouldBe: 'GrowthBook per spec' },
      { text: 'AES-128 at rest', hallucinated: true, shouldBe: 'AES-256 per spec' },
      { text: 'SPA-only, no SSR', hallucinated: true, shouldBe: 'Hybrid SSR for SEO' },
      { text: 'Skipped load tests', hallucinated: true, shouldBe: 'Load tests per spec' },
    ],
    engineered: [
      { text: 'PostgreSQL 15', hallucinated: false },
      { text: 'JWT RS256', hallucinated: false },
      { text: '90-day retention', hallucinated: false },
      { text: 'SOC2 compliance index wired', hallucinated: false },
      { text: 'PII redaction guardrail', hallucinated: false },
      { text: 'Hono + Drizzle', hallucinated: false },
      { text: 'i18n for EU', hallucinated: false },
      { text: 'Server-authoritative totals', hallucinated: false },
      { text: 'OTEL traces', hallucinated: false },
      { text: 'Per-tenant rate limits', hallucinated: false },
      { text: 'Framework CSRF', hallucinated: false },
      { text: 'GrowthBook flags', hallucinated: false },
      { text: 'AES-256', hallucinated: false },
      { text: 'Hybrid SSR', hallucinated: false },
      { text: 'Load tests wired', hallucinated: false },
    ],
  },
}

const SUMMARY = {
  Simple: 'At low complexity, both approaches succeed. The divergence is invisible.',
  Moderate: "3 hallucinations already slip through Vibe. Engineered's bounded scope keeps it grounded.",
  Complex: "Vibe's recall collapses below 50%. Engineered holds above 95% per agent — every constraint survives.",
  Enterprise: 'Vibe produces 15 hallucinated decisions at enterprise scale. Engineered produces 0 because no agent ever grows beyond its slice of the spec.',
}

const PILL_LIMIT = 9

function fmtTok(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

function recallColor(ratio) {
  const pct = ratio * 100
  if (pct < 50) return C.red
  if (pct < 80) return C.yellow
  return C.green
}

function qualityColor(q) {
  if (q < 50) return C.red
  if (q < 80) return C.yellow
  return C.green
}

function Metric({ label, value, sub, valueColor, barPct, barColor, testId }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '8px 10px',
      background: C.surfaceDeep,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: C.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </span>
        <span
          data-testid={testId}
          style={{
            color: valueColor || C.text,
            fontFamily: FONT_MONO,
            fontSize: 15,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>
      </div>
      {sub && (
        <div style={{ color: C.textFaint, fontSize: 11, fontFamily: FONT_MONO }}>
          {sub}
        </div>
      )}
      {typeof barPct === 'number' && (
        <div style={{
          height: 4, background: C.bg, borderRadius: 2, overflow: 'hidden', marginTop: 2,
        }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, barPct))}%`,
            height: '100%',
            background: barColor || C.accent,
            transition: 'width 0.25s ease',
          }} />
        </div>
      )}
    </div>
  )
}

function OutputPill({ text, hallucinated, shouldBe }) {
  const borderColor = hallucinated ? C.red : C.green
  const textColor = hallucinated ? C.red : C.green
  const bg = hallucinated ? C.redGlow : C.greenGlow
  return (
    <div
      title={hallucinated && shouldBe ? `Should be: ${shouldBe}` : undefined}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 2,
        padding: '6px 10px',
        borderRadius: 999,
        border: `1px solid ${borderColor}`,
        background: bg,
        maxWidth: '100%',
      }}
    >
      <span style={{
        color: textColor,
        fontFamily: FONT_MONO,
        fontSize: 11,
        fontWeight: 600,
        textDecoration: hallucinated ? 'line-through' : 'none',
        textDecorationColor: hallucinated ? 'rgba(239,68,68,0.6)' : undefined,
      }}>
        {text}
      </span>
      {hallucinated && shouldBe && (
        <span style={{
          color: C.textFaint,
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontStyle: 'italic',
        }}>
          → {shouldBe}
        </span>
      )}
    </div>
  )
}

function SideColumn({ side, title, accent, label, data, samples, testId }) {
  const isVibe = side === 'vibe'
  const contextTok = isVibe ? data.contextTok : data.agents * data.contextTokPerAgent
  const contextSub = isVibe
    ? `single session`
    : `${data.agents} × ${fmtTok(data.contextTokPerAgent)} per agent`
  const effectiveLabel = isVibe
    ? `${fmtTok(data.effectiveTok)} total`
    : `${fmtTok(data.effectiveTokPerAgent)} / agent`
  const effectiveSub = isVibe
    ? 'drowned in noise past the middle'
    : 'each slice stays inside recall zone'
  const recallPct = data.constraintRecall * 100
  const rColor = recallColor(data.constraintRecall)
  const hColor = isVibe ? (data.hallucinations > 0 ? C.red : C.yellow) : C.green
  const wallSub = isVibe
    ? 'serial'
    : `parallel (${data.agents} agents)`
  const qColor = qualityColor(data.quality)

  const shownSamples = samples.slice(0, PILL_LIMIT)
  const hiddenCount = Math.max(0, samples.length - PILL_LIMIT)

  return (
    <div
      data-testid={testId}
      style={{
        background: C.surface,
        border: `1px solid ${accent}`,
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: `0 0 0 1px ${isVibe ? C.redGlow : C.greenGlow}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', background: accent,
            display: 'inline-block',
          }} />
          <h3 style={{ color: C.text, fontSize: 17, margin: 0, fontWeight: 700 }}>
            {title}
          </h3>
        </div>
        <span style={{ color: C.textFaint, fontSize: 11, fontFamily: FONT_MONO }}>
          {label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Metric
          label="Context tokens"
          value={fmtTok(contextTok)}
          sub={contextSub}
        />
        <Metric
          label="Effective context"
          value={effectiveLabel}
          sub={effectiveSub}
        />
        <Metric
          label="Constraint recall"
          value={`${recallPct.toFixed(0)}%`}
          valueColor={rColor}
          barPct={recallPct}
          barColor={rColor}
          testId={isVibe ? 'vibe-recall' : 'engineered-recall'}
        />
        <Metric
          label="Hallucinations"
          value={String(data.hallucinations)}
          valueColor={hColor}
          sub={data.hallucinations === 0 ? 'grounded' : 'drifted from spec'}
        />
        <Metric
          label="Wall-clock"
          value={`${data.wallClockMin} min`}
          sub={wallSub}
        />
        <Metric
          label="Quality score"
          value={`${data.quality}/100`}
          valueColor={qColor}
          barPct={data.quality}
          barColor={qColor}
        />
      </div>

      <div style={{
        marginTop: 4,
        borderTop: `1px dashed ${C.border}`,
        paddingTop: 10,
      }}>
        <div style={{
          color: C.textDim, fontSize: 11, textTransform: 'uppercase',
          letterSpacing: 0.4, marginBottom: 6,
        }}>
          Generated decisions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {shownSamples.map((s, i) => (
            <OutputPill key={i} text={s.text} hallucinated={s.hallucinated} shouldBe={s.shouldBe} />
          ))}
          {hiddenCount > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px dashed ${isVibe ? C.red : C.green}`,
              color: isVibe ? C.red : C.green,
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 600,
              background: 'transparent',
            }}>
              +{hiddenCount} more {isVibe ? 'hallucinated' : 'grounded'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MonolithicVsDecomposed() {
  const [level, setLevel] = useState('Simple')
  const data = DATA[level]
  const samples = OUTPUT_SAMPLES[level]

  return (
    <div style={{
      padding: '16px 20px',
      fontFamily: FONT_SANS,
      maxWidth: 1200,
      margin: '0 auto',
      color: C.text,
    }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ color: C.text, fontSize: 20, margin: '0 0 2px 0', fontWeight: 700 }}>
          Vibe vs Engineered
          <span style={{ color: C.textDim, fontWeight: 400, fontSize: 14, marginLeft: 8 }}>
            — Same task, two approaches
          </span>
        </h2>
        <p style={{ color: C.textFaint, fontSize: 12, margin: 0 }}>
          At the same project complexity, what are the two approaches actually producing?
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        padding: '8px 10px',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
      }}>
        <span style={{
          color: C.textDim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}>
          Project complexity
        </span>
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
          {LEVELS.map((l) => {
            const active = l === level
            return (
              <button
                key={l}
                data-testid={`complexity-btn-${l}`}
                onClick={() => setLevel(l)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: FONT_SANS,
                  fontWeight: 600,
                  background: active ? C.accentGlow : 'transparent',
                  border: `1px solid ${active ? C.accent : C.border}`,
                  color: active ? C.accent : C.textDim,
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {l}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SideColumn
          side="vibe"
          title="Vibe"
          accent={C.red}
          label="one monolithic session"
          data={data.vibe}
          samples={samples.vibe}
          testId="side-vibe"
        />
        <SideColumn
          side="engineered"
          title="Engineered"
          accent={C.green}
          label="decomposed wave plan"
          data={data.engineered}
          samples={samples.engineered}
          testId="side-engineered"
        />
      </div>

      <div style={{
        marginTop: 12,
        padding: '10px 14px',
        background: C.surfaceDeep,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.accent}`,
        borderRadius: 6,
        fontSize: 13,
        color: C.text,
        lineHeight: 1.5,
      }}>
        {SUMMARY[level]}
      </div>
    </div>
  )
}
