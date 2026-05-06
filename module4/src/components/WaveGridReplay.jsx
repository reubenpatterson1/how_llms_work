// module4/src/components/WaveGridReplay.jsx
import { useEffect, useState, useRef } from 'react';
import { HELLO_WORLD_TRACE } from '../data/wave-trace';

const STATE = { PENDING: 'pending', RUNNING: 'running', DONE: 'done' };

export default function WaveGridReplay() {
  const [waves, setWaves] = useState({}); // { 0: ['weather-service', 'health-handler'], ... }
  const [statuses, setStatuses] = useState({}); // { component_id: 'pending' | 'running' | 'done' }
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);

  const reset = () => {
    setWaves({});
    setStatuses({});
    setDone(false);
    setElapsed(0);
  };

  useEffect(() => {
    if (done) return;
    startRef.current = performance.now();
    const timeouts = HELLO_WORLD_TRACE.map(({ t, event, payload }) =>
      setTimeout(() => {
        setElapsed(Math.round(performance.now() - startRef.current));
        if (event === 'build:wave:start') {
          setWaves(w => ({ ...w, [payload.wave_index]: payload.components }));
          setStatuses(s => {
            const next = { ...s };
            payload.components.forEach(c => { next[c] = STATE.PENDING; });
            return next;
          });
        } else if (event === 'build:component:start') {
          setStatuses(s => ({ ...s, [payload.component_id]: STATE.RUNNING }));
        } else if (event === 'build:component:done') {
          setStatuses(s => ({ ...s, [payload.component_id]: STATE.DONE }));
        } else if (event === 'build:complete') {
          setDone(true);
        }
      }, t)
    );
    return () => timeouts.forEach(clearTimeout);
  }, [done]);

  const cardClass = (status) => {
    if (status === STATE.RUNNING) return 'card running';
    if (status === STATE.DONE) return 'card done';
    return 'card pending';
  };

  return (
    <div className="wave-replay">
      <div className="wave-replay__header">
        <span>Elapsed: {elapsed}ms</span>
        {done && <button onClick={reset}>Replay</button>}
      </div>
      {Object.keys(waves).sort((a, b) => a - b).map(idx => (
        <div className="wave" key={idx}>
          <h4>Wave {idx}</h4>
          <div className="wave__row">
            {waves[idx].map(c => (
              <div key={c} className={cardClass(statuses[c])}>
                <div className="card__name">{c}</div>
                <div className="card__status">{statuses[c]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <style>{`
        .wave-replay { padding: 1rem; }
        .wave-replay__header { display: flex; justify-content: space-between; margin-bottom: 1rem; font-family: monospace; }
        .wave { margin-bottom: 1.5rem; }
        .wave h4 { margin: 0 0 .5rem; color: #94a3b8; font-weight: 600; }
        .wave__row { display: flex; gap: 1rem; }
        .card { flex: 1; background: #1e293b; border: 2px solid #334155; border-radius: 8px; padding: 1rem; transition: all .25s; }
        .card.running { border-color: #3b82f6; box-shadow: 0 0 12px rgba(59,130,246,.4); }
        .card.done { border-color: #22c55e; background: #162b1f; }
        .card__name { font-weight: 600; }
        .card__status { font-size: .75rem; color: #94a3b8; margin-top: .25rem; }
        button { background: #3b82f6; color: white; border: none; padding: .35rem .75rem; border-radius: 6px; cursor: pointer; }
      `}</style>
    </div>
  );
}
