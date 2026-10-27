# DocPilot Overview

DocPilot is a Visual Studio Code extension that automatically generates and maintains living documentation for your projects. Using your OpenAI API key, it reads your project's saved source files and existing documentation, compares changes, and updates four core documents to keep your project knowledge current across coding sessions.

## Purpose

The extension aims to help developers keep comprehensive, accurate, and up-to-date project documentation without manual rewriting. It generates:
- An overview describing the project's purpose and usage.
- Setup instructions including prerequisites and commands.
- Architecture insights covering the project's structure and data flow.
- Session notes summarizing changes, open questions, and handoff information.

## Key Features

- **Automatic and manual documentation updates**: Triggered on project open, after file saves, or via commands.
- **Integration with OpenAI**: Uses a configured model (default `gpt-4.1-mini`) supporting structured outputs.
- **Context-aware scanning**: Respects `.gitignore`, `.docpilotignore`, typical secret and build folder exclusions.
- **Redaction of sensitive information**: Detects and removes private keys, API keys, and credentials from sent files.
- **Safe file writes with backup and lock**: Prevents overwriting manual changes and allows restoration.
- **Dashboard UI**: Offers a user interface within VS Code to control generation, manage API keys, and access docs.

## Usage Summary

1. Install the DocPilot extension VSIX in VS Code.
2. Open and trust your project folder.
3. Set your OpenAI API key via the dashboard or command.
4. Generate or update the documentation to produce or refresh the four Markdown files under `docs/docpilot/`:
   - `OVERVIEW.md`
   - `SETUP.md`
   - `ARCHITECTURE.md`
   - `SESSION.md`
5. Review and commit the generated docs as part of your source control.
6. Optionally enable automatic updates in workspace settings to keep docs current.

Generated documentation is intended as complete replacements after every run. DocPilot preserves useful accurate knowledge from prior docs and updates details based on current source and context, warning when context is partial due to scanning limits.

For detailed workflow, installation, and configuration instructions, see the accompanying `SETUP.md` and user guide.
