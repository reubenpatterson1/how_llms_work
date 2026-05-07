const log = document.getElementById("log");
const buildBtn = document.getElementById("image-build");
const pushBtn = document.getElementById("image-push");
const applyBtn = document.getElementById("apply");
const liveLink = document.getElementById("live-link");

function append(line) {
  log.textContent += line + "\n";
  log.scrollTop = log.scrollHeight;
}

// Custom-template upload: re-render auto-fields onto the user's template, then load into Monaco
const templateFile = document.getElementById("template-file");
const templateStatus = document.getElementById("template-status");
const templateMeta = document.getElementById("template-meta");
const resetTemplateBtn = document.getElementById("reset-template");

if (templateFile) {
  templateFile.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    append(`> render custom template: ${f.name} (${(text.length/1024).toFixed(1)}k chars)`);
    const r = await fetch(`${window.PFX || ""}/deploy/render`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({run_id: window.RUN_ID, template_text: text}),
    });
    const body = await r.json();
    if (!r.ok) {
      append(`ERROR: ${body.error}`);
      return;
    }
    if (window.EDITOR) window.EDITOR.setValue(body.yaml);
    if (templateStatus) {
      templateStatus.textContent = "custom";
      templateStatus.style.color = "#fbbf24";
    }
    if (templateMeta) templateMeta.textContent = `Loaded ${f.name} — auto-fields rendered for this run.`;
  });
}
if (resetTemplateBtn) {
  resetTemplateBtn.addEventListener("click", () => {
    if (templateFile) templateFile.value = "";
    if (window.EDITOR && window.DEFAULT_RENDERED_YAML) window.EDITOR.setValue(window.DEFAULT_RENDERED_YAML);
    if (templateStatus) {
      templateStatus.textContent = "default";
      templateStatus.style.color = "";
    }
    if (templateMeta) templateMeta.textContent = "Using built-in fubo Application template";
  });
}

// Use the server-rendered ECR image tag (full registry/repo:tag format)
// e.g. 650127479436.dkr.ecr.us-east-1.amazonaws.com/architect-builds/<spec_slug>:<run_short>
const imageTag = window.IMAGE_TAG;
if (!imageTag) {
  append("ERROR: window.IMAGE_TAG not set — server rendered the deploy page without an image. Reload?");
}

function setBtnState(btn, state, label) {
  // state: 'idle' | 'running' | 'done' | 'error'
  btn.disabled = state === "running" || state === "done";
  btn.textContent = label;
  btn.dataset.state = state;
  // visual hint
  btn.style.opacity = state === "done" ? "0.7" : "";
}

buildBtn.addEventListener("click", async () => {
  setBtnState(buildBtn, "running", "1. Building image…");
  append(`> docker build --platform linux/amd64 -t ${imageTag} <workspace>`);
  const r = await fetch(`${window.PFX || ""}/deploy/image-build`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({run_id: window.RUN_ID, image: imageTag}),
  });
  const body = await r.json();
  if (r.ok) {
    append((body.output || "").trim() || "(image built)");
    setBtnState(buildBtn, "done", "✓ 1. Image built");
    setBtnState(pushBtn, "idle", "2. Push to ECR");
  } else {
    append(`ERROR: ${body.error}`);
    setBtnState(buildBtn, "error", "1. Build Image (retry)");
  }
});

pushBtn.addEventListener("click", async () => {
  setBtnState(pushBtn, "running", "2. Pushing to ECR…");
  append(`> docker push ${imageTag}`);
  const r = await fetch(`${window.PFX || ""}/deploy/image-push`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({image: imageTag}),
  });
  const body = await r.json();
  if (r.ok) {
    append((body.output || "").trim() || "(pushed)");
    setBtnState(pushBtn, "done", "✓ 2. Pushed to ECR");
    setBtnState(applyBtn, "idle", "3. Apply");
  } else {
    append(`ERROR: ${body.error}`);
    setBtnState(pushBtn, "error", "2. Push to ECR (retry)");
  }
});

applyBtn.addEventListener("click", async () => {
  setBtnState(applyBtn, "running", "3. Applying + polling ingress…");
  const yamlText = window.EDITOR.getValue();
  const hostMatch = yamlText.match(/host:\s*(\S+)/);
  const pathMatch = yamlText.match(/healthcheck:\s*\n\s*path:\s*(\S+)/);
  const host = hostMatch ? hostMatch[1] : window.HOST;
  const healthcheck_path = pathMatch ? pathMatch[1] : "/";
  append(`> kubectl apply -f <rendered.yaml>`);
  const r = await fetch(`${window.PFX || ""}/deploy/apply`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({yaml: yamlText, host, healthcheck_path}),
  });
  const body = await r.json();
  if (!r.ok) {
    append(`ERROR: ${body.error}`);
    setBtnState(applyBtn, "error", "3. Apply (retry)");
    return;
  }
  if (body.kubectl_missing) {
    append("kubectl not available on the agent host — apply from a machine with cluster auth.");
    showApplyHandoff(body);
    setBtnState(applyBtn, "done", "3. See manual-apply panel ↓");
    return;
  }
  append((body.applied || "").trim() || "(applied)");
  append(`Ingress ready after ${body.ingress_ready_after_s.toFixed(1)}s`);
  liveLink.innerHTML = `Live at <a href="${body.url}" target="_blank">${body.url}</a>`;
  setBtnState(applyBtn, "done", "✓ 3. Live");
});

function showApplyHandoff(body) {
  let panel = document.getElementById("manual-apply-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "manual-apply-panel";
    panel.style.cssText = "margin-top: 1rem; padding: 1rem; background: #1e293b; border: 1px solid #fbbf24; border-radius: 8px;";
    log.parentNode.insertBefore(panel, log.nextSibling);
  }
  panel.innerHTML = `
    <h3 style="margin: 0 0 .5rem; font-size: .9rem; color: #fbbf24;">Manual apply needed</h3>
    <p style="font-size: .8rem; color: #cbd5e1; margin-bottom: .75rem;">
      Run this on a machine with cluster auth (your laptop with kubeconfig pointing at the EKS cluster):
    </p>
    <textarea id="apply-cmd" readonly style="width: 100%; height: 14rem; font-family: 'IBM Plex Mono', monospace; font-size: .75rem; background: #020617; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: .75rem; resize: vertical;"></textarea>
    <div style="margin-top: .5rem; display: flex; gap: .5rem; align-items: center;">
      <button id="copy-apply-cmd" class="btn btn-ghost" style="font-size: .8rem;">Copy command</button>
      <button id="poll-ingress-btn" class="btn btn-primary" style="font-size: .8rem;">I've applied — poll ingress</button>
      <span id="poll-status" style="font-size: .75rem; color: #94a3b8;"></span>
    </div>
  `;
  const cmd = `cat <<'EOF' | kubectl apply -f -\n${body.yaml}EOF`;
  document.getElementById("apply-cmd").value = cmd;
  document.getElementById("copy-apply-cmd").onclick = async () => {
    await navigator.clipboard.writeText(cmd);
    document.getElementById("copy-apply-cmd").textContent = "Copied ✓";
    setTimeout(() => { document.getElementById("copy-apply-cmd").textContent = "Copy command"; }, 1500);
  };
  document.getElementById("poll-ingress-btn").onclick = async () => {
    const st = document.getElementById("poll-status");
    st.textContent = "polling…";
    const start = Date.now();
    const url = `https://${body.host}${body.healthcheck_path}`;
    while (Date.now() - start < 120000) {
      try {
        const r = await fetch(url, { mode: "no-cors", cache: "no-store" });
        // no-cors gives an opaque response; if fetch resolves, the host responded
        st.textContent = `responsive after ${((Date.now() - start) / 1000).toFixed(1)}s`;
        liveLink.innerHTML = `Live at <a href="${body.url}" target="_blank">${body.url}</a>`;
        setBtnState(applyBtn, "done", "✓ 3. Live");
        return;
      } catch (_) {
        st.textContent = `still waiting (${((Date.now() - start) / 1000).toFixed(0)}s)…`;
      }
      await new Promise(r => setTimeout(r, 5000));
    }
    st.textContent = "timeout — check ingress / DNS";
  };
}
