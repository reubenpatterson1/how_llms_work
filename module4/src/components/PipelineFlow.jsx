import { useState, useEffect, useRef } from 'react';

const STAGES = [
  { id: 'idea',      label: 'Idea',      symbol: '◇', color: '#fbbf24',
    sub: 'A problem worth solving' },
  { id: 'architect', label: 'Architect', symbol: '◆', color: '#60a5fa',
    sub: '10-channel structured intake' },
  { id: 'decompose', label: 'Decompose', symbol: '◈', color: '#a78bfa',
    sub: 'Wave-ordered build plan' },
  { id: 'build',     label: 'Build',     symbol: '◉', color: '#22d3ee',
    sub: 'Wave-parallel LLM codegen' },
  { id: 'deploy',    label: 'Deploy',    symbol: '▲', color: '#22c55e',
    sub: 'Image → ECR → cluster' },
  { id: 'test',      label: 'Test',      symbol: '✓', color: '#fb923c',
    sub: '→ Module 5' },
];

const STEP_MS = 1100;

export default function PipelineFlow() {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [done, setDone] = useState(false);
  const timeoutsRef = useRef([]);

  const start = () => {
    setActiveIdx(-1);
    setDone(false);
    timeoutsRef.current.forEach(clearTimeout);
    const timeouts = STAGES.map((_, i) =>
      setTimeout(() => {
        setActiveIdx(i);
        if (i === STAGES.length - 1) {
          setTimeout(() => setDone(true), STEP_MS);
        }
      }, (i + 1) * STEP_MS)
    );
    timeoutsRef.current = timeouts;
  };

  useEffect(() => {
    start();
    return () => timeoutsRef.current.forEach(clearTimeout);
  }, []);

  const stageState = (i) => {
    if (i < activeIdx) return 'done';
    if (i === activeIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="pipeline-flow">
      <div className="pipeline-row">
        {STAGES.map((s, i) => (
          <div key={s.id} className="pipeline-cell">
            <div className={`pipeline-stage pipeline-${stageState(i)}`}>
              <div className="pipeline-symbol" style={{color: s.color}}>{s.symbol}</div>
              <div className="pipeline-label">{s.label}</div>
              <div className="pipeline-sub">{s.sub}</div>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`pipeline-arrow ${i < activeIdx ? 'pipeline-arrow-done' : ''} ${i === activeIdx ? 'pipeline-arrow-active' : ''}`}>
                <span>→</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="pipeline-actions">
        {done ? (
          <button onClick={start}>Replay</button>
        ) : (
          <span className="pipeline-status">
            {activeIdx < 0 ? '…' : `${STAGES[activeIdx].label} →`}
          </span>
        )}
      </div>
      <style>{`
        .pipeline-flow {
          padding: 1.5rem 0;
        }
        .pipeline-row {
          display: flex;
          align-items: stretch;
          justify-content: center;
          flex-wrap: wrap;
          gap: 0;
        }
        .pipeline-cell {
          display: flex;
          align-items: center;
          gap: 0;
        }
        .pipeline-stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem 0.75rem;
          min-width: 130px;
          border-radius: 12px;
          border: 2px solid transparent;
          transition: all 0.4s ease;
          opacity: 0.45;
        }
        .pipeline-pending {
          opacity: 0.4;
        }
        .pipeline-pending .pipeline-symbol {
          color: #475569 !important;
        }
        .pipeline-pending .pipeline-label,
        .pipeline-pending .pipeline-sub {
          color: #475569;
        }
        .pipeline-active {
          opacity: 1;
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.15);
          background: rgba(30, 41, 59, 0.6);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .pipeline-active .pipeline-symbol {
          filter: drop-shadow(0 0 12px currentColor);
          transform: scale(1.15);
        }
        .pipeline-done {
          opacity: 0.85;
        }
        .pipeline-symbol {
          font-size: 2.75rem;
          line-height: 1;
          margin-bottom: 0.5rem;
          transition: transform 0.4s ease, filter 0.4s ease;
        }
        .pipeline-label {
          font-size: 1.05rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }
        .pipeline-sub {
          font-size: 0.75rem;
          color: #94a3b8;
          text-align: center;
          line-height: 1.3;
          max-width: 130px;
        }
        .pipeline-arrow {
          color: #334155;
          font-size: 1.5rem;
          padding: 0 0.4rem;
          transition: color 0.4s, transform 0.4s;
          align-self: center;
          margin-top: -1.5rem;
        }
        .pipeline-arrow-done {
          color: #94a3b8;
        }
        .pipeline-arrow-active {
          color: #60a5fa;
          transform: scale(1.3);
          animation: pulse 0.8s ease-in-out infinite alternate;
        }
        @keyframes pulse {
          from { opacity: 0.6; }
          to   { opacity: 1; }
        }
        .pipeline-actions {
          margin-top: 2rem;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 2rem;
        }
        .pipeline-status {
          font-family: 'IBM Plex Mono', monospace;
          color: #94a3b8;
          font-size: 0.875rem;
        }
        .pipeline-actions button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.5rem 1.25rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95rem;
        }
        .pipeline-actions button:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}
