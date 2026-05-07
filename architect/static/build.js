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

// Filter: only handle events for THIS run (server broadcasts; we ignore other runs)
function isOurRun(p) {
  return p && p.run_id && runId && p.run_id === runId;
}

socket.on("build:wave:start", (p) => {
  if (!isOurRun(p)) return;
  p.components.forEach(id => ensureCard(id, p.wave_index));
});

socket.on("build:component:start", (p) => {
  if (!isOurRun(p)) return;
  const card = cards[p.component_id];
  if (card) {
    card.className = "card running";
    card.querySelector(".status").textContent = "running…";
  }
});

socket.on("build:component:done", (p) => {
  if (!isOurRun(p)) return;
  const card = cards[p.component_id];
  if (card) {
    card.className = "card done";
    card.querySelector(".status").textContent = "done";
    card.querySelector(".duration").textContent = `${p.duration_ms}ms → ${p.file_path}`;
  }
});

socket.on("build:component:error", (p) => {
  if (!isOurRun(p)) return;
  const card = cards[p.component_id];
  if (card) {
    card.className = "card error";
    card.querySelector(".status").textContent = "error";
    card.querySelector(".duration").textContent = p.error;
  }
});

socket.on("build:wave:done", (p) => {
  if (!isOurRun(p)) return;
  // optional: show wave-completion progress
});

socket.on("build:complete", (p) => {
  if (!isOurRun(p)) return;
  const link = document.createElement("a");
  link.href = `${window.PFX || ""}/deploy?run=${runId}`;
  link.textContent = "Continue to Deploy →";
  link.style.cssText = "display:inline-block;margin-top:1rem;color:#60a5fa;font-weight:600;";
  grid.appendChild(link);
});

socket.on("build:fatal", (p) => {
  if (!isOurRun(p)) return;
  const err = document.createElement("p");
  err.textContent = `Build failed: ${p.error}`;
  err.style.color = "#ef4444";
  grid.appendChild(err);
});

// Upload UI: file picker + paste textarea (mirrors decompose page)
let uploadedPackage = "";
const fileInput = document.getElementById("package-file");
const textarea = document.getElementById("package-textarea");
const clearBtn = document.getElementById("clear-upload");
const uploadStatus = document.getElementById("upload-status");
const uploadMeta = document.getElementById("upload-meta");

function setUploaded(text, source) {
  uploadedPackage = (text || "").trim();
  if (uploadStatus) {
    uploadStatus.textContent = uploadedPackage ? "using upload" : (window.PACKAGE_PATH ? "from query" : "no source");
    uploadStatus.style.color = uploadedPackage ? "#fbbf24" : "";
  }
  if (uploadMeta) {
    uploadMeta.textContent = uploadedPackage
      ? `Loaded ${(uploadedPackage.length / 1024).toFixed(1)}k chars${source ? " from " + source : ""} — Start Build will use the upload.`
      : (window.PACKAGE_PATH ? `Default: ${window.PACKAGE_PATH}` : "");
  }
  if (clearBtn) clearBtn.disabled = !uploadedPackage;
}

if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    if (textarea) textarea.value = text;
    setUploaded(text, f.name);
  });
}
if (textarea) {
  textarea.addEventListener("input", () => setUploaded(textarea.value, "paste"));
}
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (textarea) textarea.value = "";
    if (fileInput) fileInput.value = "";
    setUploaded("", null);
  });
}

function showStatus(text, color) {
  let banner = document.getElementById("build-status-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "build-status-banner";
    banner.style.cssText = "padding: .6rem 1rem; margin-bottom: 1rem; border-radius: 6px; font-family: 'IBM Plex Mono', monospace; font-size: .85rem;";
    grid.parentNode.insertBefore(banner, grid);
  }
  banner.textContent = text;
  banner.style.background = color === "red" ? "#2b1616" : color === "green" ? "#162b1f" : "#1e293b";
  banner.style.color = color === "red" ? "#fca5a5" : color === "green" ? "#86efac" : "#94a3b8";
  banner.style.border = `1px solid ${color === "red" ? "#7f1d1d" : color === "green" ? "#166534" : "#334155"}`;
}

socket.on("build:start", (p) => {
  if (!isOurRun(p)) return;
  showStatus(`Build started — ${p.total_components} components in ${p.total_waves} waves`, "blue");
});

socket.on("build:complete", (p) => {
  if (!isOurRun(p)) return;
  showStatus(`Build complete in ${(p.duration_ms / 1000).toFixed(1)}s`, "green");
});

socket.on("build:fatal", (p) => {
  if (!isOurRun(p)) return;
  showStatus(`Build failed: ${p.error}`, "red");
});

startBtn.addEventListener("click", async () => {
  if (!uploadedPackage && !window.PACKAGE_PATH) {
    alert("Upload a build-package YAML or pass ?package=<path> in the URL before starting.");
    return;
  }
  startBtn.disabled = true;
  showStatus("Requesting run_id…", "blue");
  const payload = uploadedPackage
    ? { package_text: uploadedPackage }
    : { package: window.PACKAGE_PATH };
  const r = await fetch(`${window.PFX || ""}/build/start`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  const body = await r.json();
  if (!r.ok) {
    showStatus(`Build start failed: ${body.error}`, "red");
    startBtn.disabled = false;
    return;
  }
  runId = body.run_id;
  // Join the room BEFORE the server's 1s grace period elapses
  socket.emit("join", {room: `build:${runId}`});
  showStatus(`Joined build:${runId} — waiting for first wave…`, "blue");
});
