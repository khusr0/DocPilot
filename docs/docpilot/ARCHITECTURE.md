# DocPilot Architecture

DocPilot is implemented as a VS Code extension, structured into core modules and integrated with the OpenAI API. It provides a dashboard UI and commands to generate and update project documentation.

## High-Level Structure

- **Extension host integration (`src/extension.js`)**
  - Registers commands and status bar item.
  - Coordinates generation runs, key prompts, and automatic scheduling.
  - Manages AbortControllers, runs progress reporting, and error handling.
  - Reads workspace and user configuration.

- **Core logic (`src/core.js`)**
  - Scans project source files, respecting `.gitignore`, `.docpilotignore`, and default excludes.
  - Performs sensitive content detection and redaction.
  - Compares current files with previously scanned hashes.
  - Builds generation requests with structured input and instructions.
  - Parses OpenAI Responses API output ensuring completeness and validity.
  - Performs the API call and handles errors.

- **Documentation storage (`src/storage.js`)**
  - Reads and writes the four living documentation Markdown files safely.
  - Creates a backup before overwrite.
  - Uses a locking mechanism based on filesystem to prevent concurrent runs.

- **Dashboard UI (`src/panel.js`)**
  - Provides an HTML webview panel in VS Code with buttons for actions.
  - Displays status, messages, and links to settings and recovery.
  - Communicates with the extension via message passing.

## Data Flow

1. **Scan:** On command or automatic trigger, the extension scans the current project folder files, selecting eligible saved source files up to configured limits.
2. **Compare:** Hashes of scanned files are compared with previous run state to determine changes.
3. **Request:** Current source files, previous documentation, change summary, and project metadata are packed into a structured JSON payload.
4. **Generate:** The request is sent to OpenAI's Responses API with your API key.
5. **Parse:** The AI response with updated Markdown documents is parsed and validated.
6. **Write:** If valid, the new docs replace old ones atomically with backup of previous versions.
7. **Update UI:** The dashboard and status bar display current status and any messages.

## Safety and Reliability

- Strict redaction of credentials and private data before sending.
- Limits on files, characters, and file size to reduce overload.
- Lock files to prevent overlapping runs.
- Backups and staged file writes to protect against partial failures.
- Cancellation tokens and timeouts for long-running operations.

## Testing

- Automated tests cover:
  - File scanning, redaction, and comparison.
  - Generation request/response correctness.
  - Safe file writes and backup/restore.
  - Workflow including key handling, UI actions, and error scenarios.

This modular design enables reliable, user-friendly documentation maintenance tightly integrated into developers' workflows.
