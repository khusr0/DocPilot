# DocPilot Setup

This guide describes the prerequisites, installation, configuration, and basic usage to start generating project documentation with DocPilot.

## Prerequisites

- Visual Studio Code desktop edition version 1.96 or later.
- An OpenAI API key with access to a supported model (default `gpt-4.1-mini`). Ensure your API project has billing and quota available.
- A local filesystem project folder opened and trusted in VS Code.
- Internet connectivity during documentation generation.

## Installation

1. Obtain the `docpilot-0.1.0.vsix` installer file.
2. Open VS Code.
3. Go to the Extensions view (Ctrl+Shift+X / Cmd+Shift+X).
4. Click the three-dot menu and choose "Install from VSIX...".
5. Select the `docpilot-0.1.0.vsix` file and install.
6. Reload VS Code if prompted.

Verify the extension is installed by checking for **DocPilot — Living Documentation** in the installed list and a status bar icon.

## Configuration

Edit settings at the workspace or workspace-folder level (especially in multi-root workspaces).

- `docpilot.model` (string): OpenAI model to use (default: `gpt-4.1-mini`). Must support Responses API structured outputs.
- `docpilot.autoUpdate` (boolean): Enable automatic doc regeneration on project open and after saved changes (default: false).
- `docpilot.maxContextCharacters` (number): Maximum characters of source code to send per run (default: 160000, min 20000, max 400000).
- `docpilot.exclude` (string[]): Additional gitignore-style patterns to exclude from scanned context (default: []).

Typically configure these in `.vscode/settings.json`:
```json
{
  "docpilot.model": "gpt-4.1-mini",
  "docpilot.autoUpdate": false,
  "docpilot.maxContextCharacters": 160000,
  "docpilot.exclude": []
}
```

> **Important:** Do NOT put your API key in configuration files. Use the extension's secure key storage.

## Initial Setup Steps

1. Open your project folder in VS Code and trust the workspace.
2. Click the DocPilot icon/status bar or run the "DocPilot: Open Dashboard" command.
3. Use the dashboard button or command palette to "Set OpenAI API key" and enter your key.
4. Optionally customize the settings.
5. Save all project source files.
6. Click "Generate / update docs" in the dashboard or run the command to create/update documentation.

## Running

- **Commands:**
  - `docpilot.open`: Open the DocPilot dashboard.
  - `docpilot.update`: Generate or update documentation for the selected project folder.
  - `docpilot.setKey`: Set or replace your OpenAI API key.
  - `docpilot.clearKey`: Remove the stored OpenAI API key.
  - `docpilot.restore`: Restore the last backed-up documentation version and disable automatic updates.

- **Automatic updates:**
  Enable `docpilot.autoUpdate` in the workspace settings to update docs on project open and 30 seconds after saves or file changes via VS Code.

- **Files generated:**
  Located under `docs/docpilot/`: `OVERVIEW.md`, `SETUP.md`, `ARCHITECTURE.md`, and `SESSION.md`.

## Troubleshooting

- Unsaved edits in the generated docs block updates—save or discard them.
- Large files (>256 KB) or many files can cause partial context; adjust exclusions or context size.
- API errors (401, 403, 429) indicate key, permissions, or quota issues.
- Run logs are available in VS Code Output panel under "DocPilot".

For extensive troubleshooting, see the `TROUBLESHOOTING.md` file.
