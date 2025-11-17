# Remove Empty Folders

VS Code extension to search for and remove empty folders from your workspace or a selected folder in the Explorer.

## Features
- Detect empty folders recursively
- Dry-run mode to preview deletions
- Configurable ignore patterns and includeHidden option
- Logs to Output Channel and shows a completion notification with details

## Installation

1. Install dependencies:

```bash
npm install
```

2. Compile the extension:

```bash
npm run compile
```

3. Package with `vsce`:

```bash
vsce package
```

or run locally in VS Code by pressing `F5`.

## Usage
- `Remove Empty Folders: Clean Workspace` — Finds and removes empty folders for the entire workspace
- `Remove Empty Folders: Clean From Folder` — Right-click a folder in Explorer and clean from that folder

Use the `removeEmptyFolders.includeHidden`, `removeEmptyFolders.ignorePatterns`, and `removeEmptyFolders.confirmBeforeDelete` settings to control behavior.

**Warning:** Deleting folders is destructive — use Dry Run to preview what would be deleted.

## Build & Test

```bash
npm install
npm run compile
npm run test
# (optional) run integration tests in a VS Code test instance:
npm run test:integration
```
