'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const { DOC_NAMES } = require('../src/core');

test('extension workflow: first-use key prompt, updates across sessions, conflicts, API errors, restore, and key removal', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docpilot-workflow-'));
  const commands = new Map(), secrets = new Map(), errors = [], requests = [], panelMessages = [];
  const disposable = { dispose() {} };
  const uri = file => ({ scheme: 'file', fsPath: file, toString: () => 'file:///' + file.replaceAll('\\', '/') });
  const folder = { name: 'fixture', uri: uri(root) };
  let promptCount = 0, panelHandler;
  const config = { model: 'test-model', maxContextCharacters: 160000, exclude: [], autoUpdate: false };
  const vscode = {
    Uri: { joinPath: (base, ...parts) => uri(path.join(base.fsPath, ...parts)) },
    StatusBarAlignment: { Right: 2 }, ViewColumn: { One: 1 }, ProgressLocation: { Notification: 15 }, ConfigurationTarget: { WorkspaceFolder: 3 },
    commands: { registerCommand: (name, fn) => { commands.set(name, fn); return disposable; }, executeCommand: async () => {} },
    window: {
      createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      showInputBox: async () => { promptCount++; return 'sk-test-not-a-real-api-key'; },
      showInformationMessage: async () => undefined,
      showErrorMessage: async message => { errors.push(message); },
      showTextDocument: async () => {},
      withProgress: async (_options, fn) => fn({ report() {} }, { onCancellationRequested: () => disposable }),
      createWebviewPanel: () => ({ reveal() {}, dispose() {}, onDidDispose: () => disposable, webview: { postMessage: async message => panelMessages.push(message), onDidReceiveMessage: handler => { panelHandler = handler; return disposable; } } })
    },
    workspace: {
      isTrusted: true, workspaceFolders: [folder], textDocuments: [],
      getConfiguration: () => ({ get: (key, fallback) => config[key] ?? fallback, update: async (key, value) => { config[key] = value; } }),
      getWorkspaceFolder: () => folder,
      onDidSaveTextDocument: () => disposable, onDidCreateFiles: () => disposable, onDidDeleteFiles: () => disposable,
      onDidRenameFiles: () => disposable, onDidChangeConfiguration: () => disposable, onDidChangeWorkspaceFolders: () => disposable
    }
  };
  const context = {
    globalStorageUri: uri(path.join(root, '.state')), subscriptions: [],
    secrets: { get: async k => secrets.get(k), store: async (k, v) => secrets.set(k, v), delete: async k => secrets.delete(k) }
  };
  const originalLoad = Module._load, originalFetch = global.fetch;
  Module._load = function(name, ...args) { return name === 'vscode' ? vscode : originalLoad.call(this, name, ...args); };
  const { activate } = require('../src/extension');
  Module._load = originalLoad;
  t.after(async () => {
    for (const item of context.subscriptions) item.dispose();
    global.fetch = originalFetch;
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"fixture","scripts":{"start":"node main.js"}}');
  await fs.writeFile(path.join(root, 'main.js'), 'console.log("one")');
  let version = 'one', mutateDuringRequest = false, failApi = false;
  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(JSON.parse(request.input));
    if (mutateDuringRequest) await fs.writeFile(path.join(root, 'docs/docpilot/SETUP.md'), '# Manual edit\n');
    if (failApi) return { ok: false, status: 401 };
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ summary: `Session ${version}`, documents: Object.fromEntries(DOC_NAMES.map(n => [n, `# ${n}\nSession ${version}\n`])) }) }] }] }) };
  };
  activate(context);
  await commands.get('docpilot.open')();
  await panelHandler({ action: 'ready' });
  assert.ok(panelMessages.length);
  await commands.get('docpilot.update')();
  assert.equal(promptCount, 1);
  assert.equal(errors.length, 0);
  assert.equal(requests[0].previousDocumentation['SETUP.md'], null);
  assert.match(await fs.readFile(path.join(root, 'docs/docpilot/SETUP.md'), 'utf8'), /Session one/);
  await fs.writeFile(path.join(root, 'main.js'), 'console.log("two")');
  version = 'two';
  await commands.get('docpilot.update')();
  assert.equal(promptCount, 1);
  assert.equal(errors.length, 0);
  assert.match(requests[1].previousDocumentation['SETUP.md'], /Session one/);
  assert.ok(requests[1].changesInScannedFiles.changed.includes('main.js'));
  assert.match(await fs.readFile(path.join(root, 'docs/docpilot/SETUP.md'), 'utf8'), /Session two/);
  mutateDuringRequest = true;
  await commands.get('docpilot.update')();
  assert.match(errors.at(-1), /Documentation changed/);
  assert.equal(await fs.readFile(path.join(root, 'docs/docpilot/SETUP.md'), 'utf8'), '# Manual edit\n');
  mutateDuringRequest = false;
  failApi = true;
  await commands.get('docpilot.update')();
  assert.match(errors.at(-1), /API key rejected/);
  assert.equal(await fs.readFile(path.join(root, 'docs/docpilot/SETUP.md'), 'utf8'), '# Manual edit\n');
  const before = requests.length;
  vscode.workspace.textDocuments = [{ uri: uri(path.join(root, 'docs/docpilot/SETUP.md')), isDirty: true }];
  await commands.get('docpilot.update')();
  assert.match(errors.at(-1), /unsaved DocPilot documentation/);
  assert.equal(requests.length, before);
  vscode.workspace.textDocuments = [];
  await commands.get('docpilot.restore')();
  assert.match(await fs.readFile(path.join(root, 'docs/docpilot/SETUP.md'), 'utf8'), /Session one/);
  assert.equal(config.autoUpdate, false);
  await commands.get('docpilot.clearKey')();
  assert.equal(secrets.size, 0);
});
