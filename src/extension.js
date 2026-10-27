'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { DOC_DIR, DOC_NAMES, HASH, assertNotCancelled, scanProject, buildRequest, generate } = require('./core');
const { readDocs, saveJson, loadJson, acquireLock, writeDocs } = require('./storage');
const { panelHtml } = require('./panel');
const KEY = 'docpilot.openaiApiKey';

function activate(context) {
  let panel, busy = false, disposed = false;
  let status = 'Ready when you are.', detail = 'Generate documentation for the current project.';
  const timers = new Map();
  const controllers = new Set();
  const output = vscode.window.createOutputChannel('DocPilot');
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  bar.text = '$(book) DocPilot';
  bar.tooltip = 'Open DocPilot documentation dashboard';
  bar.command = 'docpilot.open';
  bar.show();
  const configFor = folder => vscode.workspace.getConfiguration('docpilot', folder?.uri);
  const storageFor = folder => path.join(context.globalStorageUri.fsPath, HASH(folder.uri.toString()));
  const updatePanel = async () => {
    if (disposed) return;
    panel?.webview.postMessage({ hasKey: !!await context.secrets.get(KEY), status, detail, busy });
    bar.text = busy ? '$(sync~spin) DocPilot' : '$(book) DocPilot';
  };
  function report(message, details = '') {
    status = message; detail = details;
    output.appendLine(`${new Date().toISOString()} ${message} ${details}`);
    void updatePanel();
  }
  async function selectFolder() {
    const folders = vscode.workspace.workspaceFolders || [];
    if (!folders.length) throw new Error('Open a project folder in VS Code first.');
    if (folders.length === 1) return folders[0];
    return vscode.window.showWorkspaceFolderPick({ placeHolder: 'Choose the project to document' });
  }
  async function setKey() {
    const key = await vscode.window.showInputBox({ title: 'DocPilot · OpenAI API key', prompt: 'Stored in VS Code encrypted SecretStorage. Source context is sent to OpenAI when you generate. API charges apply.', password: true, ignoreFocusOut: true, placeHolder: 'sk-…', validateInput: value => value.trim().length < 20 ? 'Enter your OpenAI API key.' : undefined });
    if (key === undefined) return;
    await context.secrets.store(KEY, key.trim());
    report('API key saved.', 'You can now generate documentation.');
    return key.trim();
  }
  function guardDocuments(folder, signal) {
    assertNotCancelled(signal);
    const paths = new Set(DOC_NAMES.map(n => vscode.Uri.joinPath(folder.uri, DOC_DIR, n).toString()));
    if (vscode.workspace.textDocuments.some(doc => paths.has(doc.uri.toString()) && doc.isDirty)) throw new Error('Save or revert unsaved DocPilot documentation before updating.');
  }
  async function run(folder, automatic = false) {
    if (busy) { if (automatic && folder) schedule(folder); return; }
    let release;
    let controller;
    busy = true;
    void updatePanel();
    try {
      if (!vscode.workspace.isTrusted) throw new Error('Trust the workspace before generating documentation.');
      folder = folder || await selectFolder();
      if (!folder) return;
      if (folder.uri.scheme !== 'file') throw new Error('DocPilot requires a filesystem workspace.');
      let key = await context.secrets.get(KEY);
      if (!key && !automatic) key = await setKey();
      if (!key) { if (automatic) report('Automatic update skipped.', 'Set an OpenAI API key to enable generation.'); return; }
      guardDocuments(folder);
      const storage = storageFor(folder);
      release = await acquireLock(storage);
      const config = configFor(folder);
      controller = new AbortController();
      controllers.add(controller);
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'DocPilot', cancellable: true }, async (progress, token) => {
        const cancellation = token.onCancellationRequested(() => controller.abort());
        const timeout = setTimeout(() => controller.abort(), 240000);
        try {
          progress.report({ message: 'Reading saved source and previous documentation…' });
          report('Comparing project and documentation…', folder.name);
          const previousDocs = await readDocs(folder.uri.fsPath);
          const previousState = await loadJson(path.join(storage, 'state.json'), {});
          const options = { maxCharacters: config.get('maxContextCharacters', 160000), excludes: config.get('exclude', []), signal: controller.signal };
          const scan = await scanProject(folder.uri.fsPath, options);
          if (!scan.files.length) throw new Error('No eligible saved source files found. Check your exclusions or add project files first.');
          const docsHash = HASH(JSON.stringify(previousDocs));
          const settingsHash = HASH(JSON.stringify({ model: config.get('model'), options: { ...options, signal: undefined } }));
          if (automatic && previousState.fingerprint === scan.fingerprint && previousState.docsHash === docsHash && previousState.settingsHash === settingsHash) {
            report('Documentation is already current.', `${folder.name} · No changes since the last successful run.`);
            return;
          }
          progress.report({ message: `Updating documentation from ${scan.files.length} files…` });
          const request = buildRequest(config.get('model', 'gpt-4.1-mini'), folder.name, scan, previousDocs, previousState.hashes);
          const result = await generate(key, request, controller.signal);
          assertNotCancelled(controller.signal);
          progress.report({ message: 'Checking for changes and saving…' });
          const latestScan = await scanProject(folder.uri.fsPath, options);
          if (latestScan.fingerprint !== scan.fingerprint) {
            if (automatic) schedule(folder);
            throw new Error('Project files changed during generation. Run again to document the latest saved code.');
          }
          await writeDocs(folder.uri.fsPath, result.documents, previousDocs, storage, () => guardDocuments(folder, controller.signal));
          // The documents are committed. Do not let a cancelled request obscure that fact.
          const savedAt = new Date().toISOString();
          try {
            await saveJson(path.join(storage, 'state.json'), { savedAt, fingerprint: scan.fingerprint, settingsHash, docsHash: HASH(JSON.stringify(result.documents)), hashes: Object.fromEntries(scan.files.map(f => [f.path, f.hash])) });
          } catch { output.appendLine('Documentation saved, but run metadata could not be saved. Next automatic run may regenerate.'); }
          const limited = scan.omitted.length || scan.files.some(f => f.truncated) || scan.traversalLimited;
          report('Documentation updated.', `${folder.name} · ${scan.files.length} source files · ${new Date(savedAt).toLocaleString()}${limited ? ' · Partial context (see generated docs)' : ''}\n${result.summary}`);
          if (!automatic) {
            void vscode.window.showInformationMessage('DocPilot updated all four documentation files.', 'Open setup guide').then(choice => {
              if (choice) return vscode.window.showTextDocument(vscode.Uri.joinPath(folder.uri, DOC_DIR, 'SETUP.md'));
            });
          }
        } finally { clearTimeout(timeout); cancellation.dispose(); }
      });
    } catch (error) {
      const message = controller?.signal.aborted ? 'Generation cancelled or timed out. Check the dashboard before retrying.' : error.message;
      report('Update stopped.', message);
      if (!automatic) void vscode.window.showErrorMessage(`DocPilot: ${message}`);
    } finally {
      if (controller) controllers.delete(controller);
      try { if (release) await release(); } catch { output.appendLine('Could not release project lock. Restart the extension host before retrying.'); }
      busy = false;
      void updatePanel();
    }
  }
  async function restore() {
    if (busy) throw new Error('Wait for the active documentation run to finish.');
    const folder = await selectFolder();
    if (!folder) return;
    if (!vscode.workspace.isTrusted || folder.uri.scheme !== 'file') throw new Error('Open a trusted filesystem workspace first.');
    busy = true;
    let release;
    try {
      const storage = storageFor(folder);
      release = await acquireLock(storage);
      guardDocuments(folder);
      const backup = await loadJson(path.join(storage, 'backup.json'), null);
      if (!backup?.documents || DOC_NAMES.some(n => backup.documents[n] !== null && typeof backup.documents[n] !== 'string')) throw new Error('No complete previous version is available for this project.');
      const current = await readDocs(folder.uri.fsPath);
      await writeDocs(folder.uri.fsPath, backup.documents, current, storage, () => guardDocuments(folder));
      await fs.rm(path.join(storage, 'state.json'), { force: true });
      report('Previous documentation restored.', 'The version you replaced is now the backup. Automatic updates are paused for this workspace.');
      await configFor(folder).update('autoUpdate', false, vscode.ConfigurationTarget.WorkspaceFolder);
      if (timers.has(folder.uri.toString())) clearTimeout(timers.get(folder.uri.toString()));
    } finally { if (release) await release(); busy = false; void updatePanel(); }
  }
  async function openDocs() {
    const folder = await selectFolder();
    if (folder) await vscode.window.showTextDocument(vscode.Uri.joinPath(folder.uri, DOC_DIR, 'SETUP.md'));
  }
  const actions = {
    ready: updatePanel,
    update: () => run(), setKey,
    clearKey: async () => { await context.secrets.delete(KEY); report('API key removed.', 'Automatic generation will skip until a key is saved again.'); },
    restore, openDocs,
    settings: () => vscode.commands.executeCommand('workbench.action.openSettings', 'docpilot')
  };
  const safely = fn => async (...args) => { try { return await fn(...args); } catch (e) { report('Action stopped.', e.message); void vscode.window.showErrorMessage(`DocPilot: ${e.message}`); } };
  function open() {
    if (panel) { panel.reveal(); void updatePanel(); return; }
    panel = vscode.window.createWebviewPanel('docpilot.dashboard', 'DocPilot', vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [] });
    panel.webview.html = panelHtml(panel.webview);
    panel.webview.onDidReceiveMessage(safely(async message => {
      if (message && Object.hasOwn(actions, message.action)) await actions[message.action]();
    }), undefined, context.subscriptions);
    panel.onDidDispose(() => { panel = undefined; }, undefined, context.subscriptions);
  }
  function schedule(folder) {
    const id = folder.uri.toString();
    if (timers.has(id)) clearTimeout(timers.get(id));
    if (!configFor(folder).get('autoUpdate', false)) return;
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      if (!disposed && configFor(folder).get('autoUpdate', false)) void run(folder, true);
    }, 30000));
  }
  for (const [command, handler] of Object.entries({ open, update: actions.update, setKey, clearKey: actions.clearKey, restore })) {
    context.subscriptions.push(vscode.commands.registerCommand('docpilot.' + command, safely(handler)));
  }
  context.subscriptions.push(output, bar,
    vscode.workspace.onDidSaveTextDocument(doc => {
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      if (!folder) return;
      const relative = path.relative(folder.uri.fsPath, doc.uri.fsPath).split(path.sep).join('/');
      if (!relative.startsWith(DOC_DIR + '/')) schedule(folder);
    }),
    vscode.workspace.onDidCreateFiles(event => { for (const uri of event.files) { const f = vscode.workspace.getWorkspaceFolder(uri); if (f) schedule(f); } }),
    vscode.workspace.onDidDeleteFiles(event => { for (const uri of event.files) { const f = vscode.workspace.getWorkspaceFolder(uri); if (f) schedule(f); } }),
    vscode.workspace.onDidRenameFiles(event => { for (const { newUri } of event.files) { const f = vscode.workspace.getWorkspaceFolder(newUri); if (f) schedule(f); } }),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('docpilot')) for (const f of vscode.workspace.workspaceFolders || []) schedule(f); }),
    vscode.workspace.onDidChangeWorkspaceFolders(e => { for (const f of e.added) schedule(f); for (const f of e.removed) { clearTimeout(timers.get(f.uri.toString())); timers.delete(f.uri.toString()); } }),
    { dispose: () => { disposed = true; for (const timer of timers.values()) clearTimeout(timer); for (const c of controllers) c.abort(); panel?.dispose(); } }
  );
  for (const folder of vscode.workspace.workspaceFolders || []) schedule(folder);
}
module.exports = { activate };
