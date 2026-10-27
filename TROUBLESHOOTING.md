# DocPilot troubleshooting

Start with [Installation and first-run setup](INSTALL.md). See the [user guide](README.md) for settings and normal behavior.

## Read the run status

Open the dashboard and read the status below the four documentation cards. For details, open **View > Output** and select **DocPilot** from the output-channel dropdown. Source-file contents and API keys are not intentionally logged; review log text before sharing it.

## Installation and dashboard

| Problem | What to do |
| --- | --- |
| DocPilot is missing from Marketplace search | This build is distributed as a `.vsix`. Use **Extensions > ... > Install from VSIX...**. |
| No status-bar entry | Run **DocPilot: Open Dashboard** from the Command Palette. Confirm the extension is installed and enabled. |
| No DocPilot commands | Confirm VS Code 1.96 or later, reload after installation, and open a trusted workspace. |
| VS Code says it is being updated | Let the update finish, then reopen VS Code. |
| `code` is not recognized | Use the Extensions menu; terminal installation is optional. |
| “Open a project folder in VS Code first” | Choose **File > Open Folder...** and select the project root. |
| A filesystem workspace is required | Use a folder-backed workspace. Browser-only virtual workspaces are unsupported. |
| “Open documentation” fails before first generation | Generate successfully first. That button opens the generated `SETUP.md`; it does not create it. |

## API key and connection

| Problem | What to do |
| --- | --- |
| “API key saved” but generation fails | The badge confirms local storage only. Read the error from the generation request. |
| “API key rejected” / HTTP 401 | Use **Set OpenAI API key** to enter an active key. |
| Model access error / HTTP 403 | Check API project permissions and model access. Set `docpilot.model` to an accessible model supporting Responses structured outputs. |
| Quota or rate-limit error / HTTP 429 | Check API quota and limits. Wait before retrying a temporary rate limit; disable automatic updates while troubleshooting. |
| HTTP 400 or 404 | Check the exact model ID and compatibility with the requested API features. |
| Network failure or HTTP 500-series error | Check connectivity to OpenAI, wait, and retry. |
| An `.env` key is ignored | Enter the key through **Set OpenAI API key**; DocPilot uses SecretStorage. |
| You cancelled the key prompt | Set the key separately or click **Generate / update docs** again. Cancelling does not save a key. |

Create keys through the dashboard linked in the [official OpenAI quickstart](https://developers.openai.com/api/docs/quickstart). DocPilot cannot supply API credits or grant model access.

## Missing or incomplete documentation

| Problem | What to do |
| --- | --- |
| No eligible saved source files | Save source or Markdown files, confirm the project folder, and review `.gitignore`, `.docpilotignore`, and `docpilot.exclude`. |
| Partial context reported | Exclude irrelevant material, document a smaller folder, or raise the total context budget within its allowed range. |
| A large file is missing or incomplete | Files above 256,000 bytes are skipped; each included file contributes at most 16,000 characters. A larger total budget does not change those limits. |
| Configuration details are missing | `.env` and `.env.example` are excluded. Document required variable names and purposes in a safe Markdown file without secret values. |
| A chat decision is missing | Save it in a project Markdown file. DocPilot cannot read chat conversations. |
| Incomplete or invalid model output | The response is rejected and existing docs are kept. Retry, reduce irrelevant context, or select another compatible model. |
| Generated text is inaccurate | Correct project evidence or add a maintained explanatory note, save it, and regenerate. Review the result. |

## Conflicts and recovery

| Problem | What to do |
| --- | --- |
| Unsaved documentation blocks an update | Save or revert edits to the four files in `docs/docpilot/`. |
| Documentation changed during the run | Save the new edits and rerun so they are included in the comparison. |
| Project files changed during generation | Finish and save your changes, then rerun. An automatic run schedules another check. |
| Another run is active | Wait for it to finish, including runs in another VS Code window using the same project. |
| Lock error after a crash | Close the VS Code windows running this project and reopen it. If it persists, retain Output details for investigation rather than deleting state blindly. |
| Cancelled or timed out | Check the dashboard and current files before retrying. Runs time out after four minutes. |
| You want to undo an update | Use **Restore previous docs**. It restores one local backup and disables automatic updates for the workspace. |
| No previous version available | A backup may not exist before the first write, after local storage was cleared, or after moving the project to a new path. Check Git history if available. |
| First-run restore removed the docs | Expected if they did not exist before generation. Restoring again swaps back to the version now held in the backup. |
| Unsafe path or file-read error | Output paths must be real directories and regular files, not symlinks or junctions. Existing generated files must be at most 600,000 bytes each. |

Writes are staged and ordinary failures attempt rollback. A process or machine crash during replacement can still require restoring the backup. Keep long-term history in Git.

## Automatic updates

Confirm that `docpilot.autoUpdate` is enabled for the correct project and that a key is saved. Wait 30 seconds after the last save; further saves reset the delay. Unchanged automatic checks skip generation. Manual generation always makes a new request.

Use the button after changes made outside VS Code. Editing a generated document alone does not schedule a run through the save handler. Restoring a backup disables automatic updates; re-enable the setting when ready.
