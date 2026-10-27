# DocPilot: installation and first-run setup

This guide takes you from the installer to your first set of project documents. For settings and everyday use, see the [user guide](README.md). If a step fails, see [Troubleshooting](TROUBLESHOOTING.md).

## 1. Have these ready

| Requirement | What you need |
| --- | --- |
| VS Code | Desktop version 1.96 or later |
| Installer | The file `docpilot-0.1.0.vsix` supplied with this project |
| A project | A folder containing saved code, configuration, or documentation |
| OpenAI API access | A key with access to the configured model and available API quota |
| Internet | Access to OpenAI when generating documentation |

The packaged extension includes its dependencies. Node.js, npm, a terminal, and a separate server are not required for normal use.

## 2. Install the extension

1. Open VS Code.
2. Open **Extensions** from the left sidebar, or press **Ctrl+Shift+X** on Windows/Linux (**Cmd+Shift+X** on macOS).
3. Click the **...** menu at the top of Extensions.
4. Select **Install from VSIX...**.
5. Select `docpilot-0.1.0.vsix` from the folder where you saved it.
6. Wait for installation to finish. Reload if VS Code asks you to.

**Check:** Search your installed extensions for **DocPilot**. Its display name includes **Living Documentation**.

Install once per VS Code environment. To document another project later, open that project's folder.

## 3. Open the project you want documented

1. Choose **File > Open Folder...**.
2. Select your project's root folder, usually the folder containing its README or a file such as `package.json`, `pyproject.toml`, or `go.mod`.
3. If prompted about Workspace Trust, allow trust for a project you trust. DocPilot is disabled in Restricted Mode.
4. Save the files you want DocPilot to read.

Open your actual application project here. Open DocPilot's source folder only if you want to develop or document DocPilot itself.

**Check:** The Explorer sidebar shows your project's files. Opening a single loose file is not enough; a folder must be open.

## 4. Create an OpenAI API key

1. Sign in to the [OpenAI API platform](https://platform.openai.com/).
2. Create an API key in the dashboard for the project you intend to use. The [official OpenAI quickstart](https://developers.openai.com/api/docs/quickstart) includes the **Create an API Key** link.
3. Keep the key available to paste into DocPilot's password prompt in the next step.

Check the API project's billing/quota and model access if requests are rejected. Installing DocPilot does not provide API credits.

You can skip the quickstart's terminal and environment-variable steps for DocPilot. The extension has its own key prompt and local storage.

## 5. Connect DocPilot

1. Click **DocPilot** on the bottom status bar.
2. If the entry is unavailable, open the Command Palette with **Ctrl+Shift+P** (**Cmd+Shift+P** on macOS), then select **DocPilot: Open Dashboard**.
3. Click **Set OpenAI API key**.
4. Paste your key into the password prompt and press **Enter**.

**Check:** The dashboard says **API key saved**. This confirms local storage; the first generation verifies whether OpenAI accepts the key.

The key is stored in VS Code's encrypted SecretStorage. Do not put it in documentation, `.vscode/settings.json`, or source files. To replace it later, use **Set OpenAI API key** again.

## 6. Choose which files can be sent

Generation sends selected saved project files and previous generated docs to OpenAI. API usage is charged to your API account.

DocPilot excludes common secret files, dependency/build folders, and paths matched by `.gitignore`. To exclude more content, create `.docpilotignore` in the project root. For example:

```gitignore
private/
customer-data/
**/production-config.json
```

Adjust these example patterns for your project. Secret detection is best-effort, so exclude any other content you do not want sent. Previous generated docs are included separately for comparison.

## 7. Generate your first documentation

1. Save your project files. Save or revert any unsaved edits in `docs/docpilot/` too.
2. In the dashboard, click **Generate / update docs**.
3. If several project folders are open, choose the one you want documented.
4. Wait for the progress notification to finish. You can click **Cancel** while it is running; a run times out after four minutes.
5. When the success notification appears, click **Open setup guide**, or use **Open documentation** in the dashboard.

**Check:** The dashboard says **Documentation updated.**, and the project contains:

```text
your-project/
  docs/
    docpilot/
      OVERVIEW.md
      SETUP.md
      ARCHITECTURE.md
      SESSION.md
```

| Document | What to check |
| --- | --- |
| `OVERVIEW.md` | Purpose, features, and usage match the project |
| `SETUP.md` | Installation, configuration, and run/test commands are accurate |
| `ARCHITECTURE.md` | Components and relationships match the code |
| `SESSION.md` | The handoff describes current changes, gaps, and next steps |

Review the result. DocPilot does not execute installation commands or run your project's tests. Large projects receive partial coverage; see [scan limits](README.md#privacy-and-configuration).

## 8. Update the docs in your next session

1. Reopen the project and read `docs/docpilot/SESSION.md` for the previous handoff.
2. Work on your code and save your changes.
3. Click **Generate / update docs** again.
4. Review the updated documents.

Each successful run reads previous documentation and writes complete replacements to the same four paths. `SESSION.md` becomes the latest handoff rather than a growing transcript. Your project's original README remains in place.

DocPilot reads files, not chat history. Save decisions from conversations in a file such as `PROJECT_NOTES.md` if you want them considered in later runs.

## 9. Optional: enable automatic updates

After a successful manual run:

1. Click **Settings & automatic updates** in the dashboard.
2. Select **Workspace** so the choice applies to this project. In a multi-folder workspace, choose the relevant folder.
3. Find **Docpilot: Auto Update** and enable it.
4. Save a project file and allow roughly 30 seconds without another save.

DocPilot checks on project open and after saves, file creation, deletion, or renaming through VS Code. Further changes restart the 30-second delay. An unchanged automatic check skips the API request. Automatic runs require a saved key and can incur API charges.

To stop future automatic runs, clear the setting. Cancel any run already in progress through its progress notification. Changes made outside VS Code may require the manual generation button.

## 10. Restore the previous version

1. Save or revert unsaved edits to generated docs.
2. Click **Restore previous docs**, or run **DocPilot: Restore Previous Documentation** from the Command Palette.
3. Review the restored files.

There is one local backup of the four documents. Restoring saves the replaced version as the new backup and disables automatic updates for the workspace. Immediately after the first generation, restoring removes files that did not previously exist. Use Git for permanent history.

## Alternative: install from a terminal

If `code` is already available, open a terminal in the folder containing the installer and run:

```powershell
code --install-extension "docpilot-0.1.0.vsix"
```

If `code` is not recognized, use the Extensions menu in step 2.

## Update or remove DocPilot

To install a replacement build, repeat **Install from VSIX...** and accept a replacement prompt if shown. If VS Code skips an already-installed version, add `--force` to the terminal installation command, or uninstall before reinstalling.

To remove DocPilot, first run **DocPilot: Remove OpenAI API Key** if you want to clear its saved key. Then open **Extensions**, select DocPilot, and choose **Uninstall**. Removing the stored key does not revoke it at OpenAI; manage it in the API dashboard if needed. Generated Markdown files remain in your project.
