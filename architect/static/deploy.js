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

let imageTag = `architect-${window.RUN_ID}:${Date.now()}`;

buildBtn.addEventListener("click", async () => {
  buildBtn.disabled = true;
  append(`> docker build -t ${imageTag} <workspace>`);
  const r = await fetch(`${window.PFX || ""}/deploy/image-build`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({run_id: window.RUN_ID, image: imageTag}),
  });
  const body = await r.json();
  if (r.ok) { append(body.output || "ok"); pushBtn.disabled = false; }
  else { append(`ERROR: ${body.error}`); buildBtn.disabled = false; }
});

pushBtn.addEventListener("click", async () => {
  pushBtn.disabled = true;
  append(`> docker push ${imageTag}`);
  const r = await fetch(`${window.PFX || ""}/deploy/image-push`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({image: imageTag}),
  });
  const body = await r.json();
  if (r.ok) { append(body.output || "ok"); applyBtn.disabled = false; }
  else { append(`ERROR: ${body.error}`); pushBtn.disabled = false; }
});

applyBtn.addEventListener("click", async () => {
  applyBtn.disabled = true;
  const yamlText = window.EDITOR.getValue();
  // Parse the YAML client-side just enough to extract host + healthcheck path for the poll
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
  if (r.ok) {
    append(body.applied || "applied");
    append(`Ingress ready after ${body.ingress_ready_after_s.toFixed(1)}s`);
    liveLink.innerHTML = `Live at <a href="${body.url}" target="_blank">${body.url}</a>`;
  } else {
    append(`ERROR: ${body.error}`);
    applyBtn.disabled = false;
  }
});
