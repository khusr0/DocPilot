# DocPilot

A downloadable VS Code extension that keeps project documentation current across coding sessions, using your own OpenAI API key.

**Start here:** [Installation and first-run setup](INSTALL.md). For problems, see [Troubleshooting](TROUBLESHOOTING.md).

DocPilot runs inside VS Code. Install the `.vsix` file once, then open the project you want to document. The packaged extension includes its dependencies; no separate server or Node.js installation is needed to use it.

## Install and use

1. In VS Code, open **Extensions**, select **… → Install from VSIX…**, and choose `docpilot-0.1.0.vsix`.
2. Open the project folder you want documented and trust the workspace.
3. Click **DocPilot** in the bottom status bar to open the dashboard.
4. Click **Generate / update docs**. On first use, enter your OpenAI API key in the password prompt. It is stored using VS Code's encrypted SecretStorage, not in your project.
5. Find your documentation in `docs/docpilot/`.

You can also use the editor's **sync** button or run **DocPilot: Generate / Update Documentation** from the Command Palette.

## What gets written

| File | Contents |
| --- | --- |
| `docs/docpilot/OVERVIEW.md` | Purpose, features, and usage |
| `docs/docpilot/SETUP.md` | Prerequisites, installation, configuration, run/build/test instructions |
| `docs/docpilot/ARCHITECTURE.md` | Project structure, key components, and data flow |
| `docs/docpilot/SESSION.md` | Latest changes, open questions, and handoff for the next session |

Every run reads these existing files and compares them with saved project source. It asks the model to preserve useful accurate information, replace stale details, and produce complete replacement files. The four files are overwritten after a successful response; session notes do not accumulate forever. Your existing README and other documentation are read as context, but not overwritten. Commit generated docs to Git to share them across machines. The next run can use existing docs even without local run history.

## Automatic updates

Open the dashboard's **Settings & automatic updates** button and enable `docpilot.autoUpdate` for the project. The default is off. Once enabled and a key is saved, DocPilot checks the project 30 seconds after startup and after saves, file creations, deletions, and renames made through VS Code. Changes are debounced. Unchanged scanned source, generated docs, and settings skip the API call. Use the button after changes made outside VS Code.

An update is a documentation session. DocPilot reads saved files and previous documentation; it does not read your Codex, Copilot, or ChatGPT conversation history. Put decisions that are absent from source in a project Markdown file so the next run can include them. Save source files before generating.

For example, after you change an installation command in your project, the next run receives the updated source and the old setup guide. It is instructed to replace obsolete instructions in the same `SETUP.md` and refresh `SESSION.md`. Review the result, since AI output can be incorrect.

Manual generation always requests a new update, even when nothing changed. Only automatic checks skip unchanged context. Turning off automatic updates does not cancel a run already in progress; use **Cancel** in its progress notification.

## Everyday workflow

1. Open the project and read `docs/docpilot/SESSION.md` for the previous handoff.
2. Make your changes and save the project files.
3. Save or revert any manual edits to generated documentation.
4. Click **Generate / update docs**, or let automatic updates run if enabled.
5. Review the updated files, especially setup commands and open questions.
6. Commit the docs with your code if you use Git and want a lasting history.

Save decisions from conversations in a file such as `PROJECT_NOTES.md` if you want them considered on later runs. That file is eligible context unless excluded or omitted by scan limits. Keep wording that must remain exact in a separate maintained file, since generated docs are intended to be rewritten.

## Buttons and commands

Open the Command Palette with **Ctrl+Shift+P** on Windows/Linux or **Cmd+Shift+P** on macOS, then type `DocPilot`.

| Command | Action |
| --- | --- |
| **DocPilot: Open Dashboard** | Opens the main screen |
| **DocPilot: Generate / Update Documentation** | Compares saved project context and docs, then generates replacements |
| **DocPilot: Set OpenAI API Key** | Saves or replaces the key used by this extension |
| **DocPilot: Remove OpenAI API Key** | Removes the locally stored key; does not revoke it at OpenAI |
| **DocPilot: Restore Previous Documentation** | Restores the single local backup and disables automatic updates for that workspace |

The dashboard's **Open documentation** button opens the setup guide after your first successful run. **Settings & automatic updates** opens DocPilot's settings.

## Privacy and configuration

Generation sends selected source files and the previous generated documentation to `https://api.openai.com/v1/responses`. Requests use `store: false`; this is not a promise of zero server retention. OpenAI API billing and account policies apply. A ChatGPT subscription does not supply an API key or API credits.

Source selection respects root and nested `.gitignore` files, `.docpilotignore` at the project root, and `docpilot.exclude` patterns. Dependency/build folders, common secret files such as `.env`, credential files, private keys, binary files, symlinks, and lockfiles are excluded. Common inline credential formats are redacted. This is a best-effort filter, not a guarantee that arbitrary secrets are detected: review your project and exclusions before generating. Previously generated docs are always included for comparison, with the same inline redaction.

Example `.docpilotignore`:

```gitignore
private/
customer-data/
**/production-config.json
```

| Setting | Default | Purpose |
| --- | --- | --- |
| `docpilot.model` | `gpt-4.1-mini` | A model available to your API project that supports Responses structured outputs |
| `docpilot.autoUpdate` | `false` | Update on project open and after saved changes |
| `docpilot.maxContextCharacters` | `160000` | Source character budget per request |
| `docpilot.exclude` | `[]` | Additional gitignore-style exclusions |

For project-specific settings, open **Settings & automatic updates**, select **Workspace**, and search for `docpilot`. In a multi-folder workspace, choose the relevant folder for automatic updates, exclusions, and context budget. The model is a window-level setting.

Alternatively, merge these entries into your project's `.vscode/settings.json`, preserving unrelated settings:

```json
{
  "docpilot.model": "gpt-4.1-mini",
  "docpilot.autoUpdate": false,
  "docpilot.maxContextCharacters": 160000,
  "docpilot.exclude": ["private/", "customer-data/"]
}
```

The context budget accepts 20,000 to 400,000 characters. A larger budget can send more source and increase API usage, but does not raise the per-file or file-count limits. Do not put an API key in this settings file. DocPilot reads its key from SecretStorage, not `.env` or `OPENAI_API_KEY`.

Each run includes up to 120 eligible files, 16,000 characters per file, with files larger than 256 KB skipped. Previous generated docs have a separate 600 KB per-file read limit. Large repositories receive partial coverage; the model is instructed to document these limitations and not infer deletions from missing context. Commands are inferred from project evidence, not executed or tested by the extension. Review generated instructions before relying on them.

## Recovery and reliability

The last version of all four documents is backed up in VS Code's extension storage before replacement. **DocPilot: Restore Previous Documentation** restores it, saves the replaced version as the new backup, and disables automatic updates for that workspace so the restore persists. There is one backup, not a full archive; use Git for long-term history.

Save or revert unsaved generated docs before restoring. Restoring immediately after the first generation removes files that did not exist before that generation. Moving a project to another path changes its local backup identity; the Markdown files still travel with the project.

Cancellation, API errors, incomplete output, source changes during generation, and documentation edits during generation stop the update. Unsaved documentation buffers block replacement. File writes are staged, with rollback on ordinary write failures; a process or machine crash during the multi-file commit can still require restoring the backup. A project lock prevents concurrent runs across VS Code windows. Runs time out after four minutes. Logs are available under **Output → DocPilot**; API keys and source text are not logged.

This extension supports desktop VS Code 1.96+ on Windows, macOS, and Linux, including filesystem-based remote extension hosts. Browser-only virtual workspaces are not supported. In a multi-folder workspace, manual runs ask which folder to document; automatic runs handle folders independently. API keys and backup files are local to the relevant VS Code environment.

## Develop

Requires Node.js 22+ for packaging.

```sh
npm install
npm test
npm run check
npm run package
```

Press **F5** in this folder to open an Extension Development Host. The packaged artifact is `docpilot-0.1.0.vsix`. It can be installed locally without publishing to the Marketplace.

With the existing `package-lock.json`, use `npm ci` in place of `npm install` for reproducible dependencies. Run these commands in the extension source folder, not the project you want documented.

| Source file | Responsibility |
| --- | --- |
| `src/extension.js` | Commands, key prompt, scheduling, and run coordination |
| `src/core.js` | Source selection, redaction, comparison, API request, and validation |
| `src/storage.js` | Documentation reads, project lock, staged writes, and backup |
| `src/panel.js` | Dashboard interface |
| `test/core.test.js` | Scanning, response handling, backup, and file-write tests |
| `test/extension.test.js` | Workflow with mocked VS Code and OpenAI interfaces |

The 14 automated tests passed during the initial build. They do not make billed API calls. Live generation has not been verified with a real key. The initial real-editor launch check was blocked by an ongoing VS Code update; cross-platform and remote-host behavior have not been independently verified.

API implementation reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
# DocPilot
