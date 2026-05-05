const log = document.getElementById("log");
const buildBtn = document.getElementById("image-build");
const pushBtn = document.getElementById("image-push");
const applyBtn = document.getElementById("apply");
const liveLink = document.getElementById("live-link");

function append(line) {
  log.textContent += line + "\n";
  log.scrollTop = log.scrollHeight;
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
