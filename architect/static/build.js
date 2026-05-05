const socket = io({ path: (window.PFX || "") + "/socket.io" });
const grid = document.getElementById("wave-grid");
const startBtn = document.getElementById("start-build");

let runId = null;
const cards = {};  // component_id -> element

function ensureWaveRow(waveIdx) {
  let row = document.getElementById(`wave-${waveIdx}`);
  if (!row) {
    row = document.createElement("div");
    row.id = `wave-${waveIdx}`;
    row.className = "wave";
    const label = document.createElement("h3");
    label.textContent = `Wave ${waveIdx}`;
    grid.appendChild(label);
    grid.appendChild(row);
  }
  return row;
}

function ensureCard(componentId, waveIdx) {
  if (cards[componentId]) return cards[componentId];
  const row = ensureWaveRow(waveIdx);
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<div class="name">${componentId}</div><div class="status">pending</div><div class="duration"></div>`;
  row.appendChild(el);
  cards[componentId] = el;
  return el;
}

socket.on("build:wave:start", (p) => {
  p.components.forEach(id => ensureCard(id, p.wave_index));
});

socket.on("build:component:start", (p) => {
  const card = cards[p.component_id];
  if (card) {
    card.className = "card running";
    card.querySelector(".status").textContent = "running…";
  }
});

socket.on("build:component:done", (p) => {
  const card = cards[p.component_id];
  if (card) {
    card.className = "card done";
    card.querySelector(".status").textContent = "done";
    card.querySelector(".duration").textContent = `${p.duration_ms}ms → ${p.file_path}`;
  }
});

socket.on("build:component:error", (p) => {
  const card = cards[p.component_id];
  if (card) {
    card.className = "card error";
    card.querySelector(".status").textContent = "error";
    card.querySelector(".duration").textContent = p.error;
  }
});

socket.on("build:complete", (p) => {
  const link = document.createElement("a");
  link.href = `${window.PFX || ""}/deploy?run=${runId}`;
  link.textContent = "Continue to Deploy →";
  link.style.cssText = "display:inline-block;margin-top:1rem;color:#60a5fa;font-weight:600;";
  grid.appendChild(link);
});

socket.on("build:fatal", (p) => {
  const err = document.createElement("p");
  err.textContent = `Build failed: ${p.error}`;
  err.style.color = "#ef4444";
  grid.appendChild(err);
});

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  const r = await fetch(`${window.PFX || ""}/build/start`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({package: window.PACKAGE_PATH}),
  });
  const body = await r.json();
  runId = body.run_id;
  socket.emit("join", {room: `build:${runId}`});
});
