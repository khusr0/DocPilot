'use strict';
const { randomBytes } = require('node:crypto');
function panelHtml(webview) {
  const nonce = randomBytes(18).toString('base64');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>DocPilot</title><style nonce="${nonce}">
  :root { color-scheme: light dark; } * { box-sizing: border-box; }
  body { margin:0; padding:36px 28px; background:var(--vscode-editor-background); color:var(--vscode-editor-foreground); font-family:var(--vscode-font-family); line-height:1.6; }
  main { max-width:880px; margin:auto; } .eyebrow { color:var(--vscode-descriptionForeground); font-size:11px; letter-spacing:2px; text-transform:uppercase; }
  header { display:flex; justify-content:space-between; gap:16px; align-items:center; margin-bottom:42px; }
  .brand { font-size:19px; font-weight:650; letter-spacing:-.5px; } .mark { display:inline-block; padding:3px 10px; margin-right:9px; border-radius:8px; background:var(--vscode-button-background); color:var(--vscode-button-foreground); }
  .badge { border:1px solid var(--vscode-panel-border); padding:4px 12px; border-radius:20px; font-size:11px; }
  h1 { font-size:36px; letter-spacing:-1.4px; line-height:1.15; font-weight:600; margin:12px 0 16px; } .intro { color:var(--vscode-descriptionForeground); font-size:14px; max-width:610px; }
  button { font:inherit; cursor:pointer; border:1px solid transparent; border-radius:5px; padding:10px 15px; background:var(--vscode-button-secondaryBackground); color:var(--vscode-button-secondaryForeground); }
  button:hover { background:var(--vscode-button-secondaryHoverBackground); } button:focus-visible { outline:2px solid var(--vscode-focusBorder); outline-offset:3px; }
  button.primary { background:var(--vscode-button-background); color:var(--vscode-button-foreground); } button.primary:hover { background:var(--vscode-button-hoverBackground); } button:disabled { opacity:.5; cursor:wait; }
  .actions { display:flex; flex-wrap:wrap; gap:10px; margin:26px 0 30px; } .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .card { border:1px solid var(--vscode-panel-border); border-radius:9px; padding:19px; } .card h2 { font-size:13px; margin:0 0 7px; } .card p { margin:0; color:var(--vscode-descriptionForeground); font-size:12px; }
  .number { font-size:11px; color:var(--vscode-descriptionForeground); margin-bottom:14px; display:block; }
  .run { margin-top:22px; border-left:3px solid var(--vscode-button-background); padding:12px 17px; background:var(--vscode-textBlockQuote-background); } .run p { margin:3px 0; white-space:pre-wrap; overflow-wrap:anywhere; } #detail { font-size:12px; color:var(--vscode-descriptionForeground); }
  footer { margin-top:26px; font-size:11px; color:var(--vscode-descriptionForeground); } code { font-family:var(--vscode-editor-font-family); } .settings { margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; } .settings button { padding:5px 9px; font-size:11px; }
  @media(max-width:550px) { .grid { grid-template-columns:1fr; } h1 { font-size:29px; } body { padding:22px 16px; } }
  </style></head><body><main>
  <header><div class="brand"><span class="mark">D</span>DocPilot</div><span class="badge" id="keyStatus">Checking connection</span></header>
  <div class="eyebrow">Your project, kept in context</div>
  <h1>New session.<br>Up-to-date documentation.</h1>
  <p class="intro">Turn the code you’ve written into a clear setup guide and a useful handoff. DocPilot compares your saved docs with the current project, then updates them in place.</p>
  <div class="actions"><button class="primary" data-action="update" id="generate">Generate / update docs ↗</button><button data-action="setKey">Set OpenAI API key</button><button data-action="openDocs">Open documentation</button></div>
  <div class="grid">
  <article class="card"><span class="number">01 / OVERVIEW</span><h2>The project at a glance</h2><p>Purpose, features, and how to use what you’ve built.</p></article>
  <article class="card"><span class="number">02 / SETUP</span><h2>From checkout to running</h2><p>Prerequisites, installation, configuration, and verified-in-source commands.</p></article>
  <article class="card"><span class="number">03 / ARCHITECTURE</span><h2>How it fits together</h2><p>Key components, project structure, and data flow.</p></article>
  <article class="card"><span class="number">04 / SESSION</span><h2>A handoff for next time</h2><p>What changed, what’s still unknown, and where to pick up.</p></article>
  </div>
  <section class="run" aria-live="polite"><p id="status">Ready when you are.</p><p id="detail">Open a project folder to get started.</p></section>
  <div class="settings"><button data-action="settings">Settings & automatic updates</button><button data-action="restore">Restore previous docs</button><button data-action="clearKey">Remove API key</button></div>
  <footer>Saved to <code>docs/docpilot/</code> · One previous version kept locally.<br>Generation sends selected saved source files and existing documentation to OpenAI. API usage is billed to your key. Common secret files and ignored paths are excluded; review your project and use <code>.docpilotignore</code> for anything else. Chat history is not accessed.</footer>
  </main><script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => vscode.postMessage({ action: button.dataset.action })));
  window.addEventListener('message', event => {
    const state = event.data;
    document.getElementById('keyStatus').textContent = state.hasKey ? 'API key saved' : 'API key needed';
    document.getElementById('status').textContent = state.status;
    document.getElementById('detail').textContent = state.detail;
    document.getElementById('generate').disabled = state.busy;
    document.getElementById('generate').textContent = state.busy ? 'Updating documentation…' : 'Generate / update docs ↗';
  });
  vscode.postMessage({ action: 'ready' });
  </script></body></html>`;
}
module.exports = { panelHtml };
