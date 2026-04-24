import { useState } from 'react'
import { C, FONT_SANS, FONT_MONO } from '../lib/theme.js'
import { BUILD_FRAMEWORK_MD } from '../data/build-framework.md.js'

const ANNOTATIONS = [
  {
    glyph: '①',
    title: 'One concern per session',
    body: 'Rule #1 is scope. The orchestrator itself is a session — it must stay bounded just like every agent it spawns.',
  },
  {
    glyph: '②',
    title: 'Specs are external',
    body: 'RAG-fetched, not pasted. This keeps every agent working from the same canonical source without bloating context.',
  },
  {
    glyph: '③',
    title: 'Tools are verbs, not nouns',
    body: 'rag_search, run_tests, spawn_agent — the orchestrator composes them. It never "reasons about" what the tests would say.',
  },
  {
    glyph: '④',
    title: 'Ignore lists are constraints too',
    body: 'Telling the model what NOT to read prevents it from inventing code paths based on legacy or experimental files it shouldn\'t touch.',
  },
  {
    glyph: '⑤',
    title: 'Wave 0 is interfaces',
    body: 'Every parallel implementation agent compiles against the same types. No wave-1 agent can invent a schema; the interface is fixed.',
  },
  {
    glyph: '⑥',
    title: 'allowed_paths / forbidden',
    body: 'Per-agent scope is enforced by path guards. An auth agent physically cannot write to src/api.',
  },
  {
    glyph: '⑦',
    title: 'Handoff envelope, not prose',
    body: 'Structured return — the orchestrator verifies automatically. No "I think it\'s done" from an agent.',
  },
  {
    glyph: '⑧',
    title: 'Constraint check pre-commit',
    body: 'Every MUST / MUST NOT is verified before the code lands. Confabulation can\'t slip through a commit gate.',
  },
]

export default function BuildFrameworkPrompt() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(BUILD_FRAMEWORK_MD)
      } else {
        // Fallback for environments without the clipboard API.
        const ta = document.createElement('textarea')
        ta.value = BUILD_FRAMEWORK_MD
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 28px 40px',
      fontFamily: FONT_SANS, color: C.text }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
          <span style={{ color: C.accent, marginRight: 8 }}>⬒</span>
          Your Turn — build_framework.md
        </h2>
        <button
          onClick={handleCopy}
          data-testid="copy-btn"
          style={{
            padding: '6px 14px', fontSize: 12, fontFamily: FONT_MONO,
            background: copied ? `${C.green}22` : `${C.accent}22`,
            border: `1px solid ${copied ? C.green : C.accent}`,
            color: copied ? C.green : C.accent,
            borderRadius: 6, cursor: 'pointer',
          }}>
          {copied ? '✓ Copied' : 'Copy file'}
        </button>
      </div>
      <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.55, marginBottom: 16, maxWidth: 920 }}>
        A real, usable starter. Commit it at your repo root, hand it to your orchestrator session
        as the system prompt, and adapt the wave plan to your project.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Markdown code pane */}
        <pre
          data-testid="framework-code"
          style={{
            background: C.surfaceDeep, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: 14, margin: 0,
            fontSize: 11.5, fontFamily: FONT_MONO, color: C.text,
            lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 620, overflowY: 'auto',
          }}>
          {BUILD_FRAMEWORK_MD}
        </pre>

        {/* Annotations pane */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620, overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ color: C.textDim, fontSize: 12, fontFamily: FONT_MONO, marginBottom: 4, letterSpacing: 0.5 }}>
            WHAT TO NOTICE
          </div>
          {ANNOTATIONS.map((a) => (
            <div key={a.title} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: C.accent, fontSize: 16, lineHeight: 1 }}>{a.glyph}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.title}</span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.55 }}>{a.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '10px 14px', background: C.surface,
        border: `1px solid ${C.border}`, borderRadius: 8,
        fontSize: 12, color: C.textDim, lineHeight: 1.55, textAlign: 'center' }}>
        Every technique in this module — decomposition, tools, RAG, memory, scoped sessions,
        constraint reinforcement — lives somewhere in this file. This is the full playbook,
        collapsed into one handoff.
      </div>
    </div>
  )
}
