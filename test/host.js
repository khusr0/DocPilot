'use strict';
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
async function run() {
  const extension = vscode.extensions.getExtension('local-tools.docpilot');
  assert.ok(extension, 'DocPilot must be discoverable in VS Code');
  await extension.activate();
  assert.ok(extension.isActive);
  const commands = await vscode.commands.getCommands(true);
  for (const name of ['open', 'update', 'setKey', 'clearKey', 'restore']) assert.ok(commands.includes('docpilot.' + name));
  await vscode.commands.executeCommand('docpilot.open');
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  await fs.writeFile(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'smoke-result.json'), JSON.stringify({ activated: true, registeredCommands: 5, dashboardOpened: true }));
}
module.exports = { run };
