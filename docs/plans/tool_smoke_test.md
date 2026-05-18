# Plan: Toolbox Smoke Test

## Objective
Verify the basic operability of every tool in the Paser Mini ecosystem. This is a binary test: the tool either works (returns a valid response) or it fails (returns an ERR or crashes).

## Scope
- No functional validation of output accuracy.
- No edge-case or stress testing.
- Pure connectivity and execution check.

## Test Matrix

### 📁 File System
- [ ] `readFile`: Read a known existing file.
- [ ] `writeFile`: Create a temporary file.
- [ ] `removeFile`: Delete the temporary file.
- [ ] `listDir`: List the project root.
- [ ] `renamePath`: Rename a test file.
- [ ] `copyFile`: Duplicate a test file.
- [ ] `concatFile`: Append text to a test file.
- [ ] `replaceString`: Attempt a simple string replacement.

### 🔍 Search & Analysis
- [ ] `analyzeCode`: Run analysis on `src/main.js`.
- [ ] `lintCode`: Run lint on `src/main.js`.
- [ ] `generateDocs`: Generate docs for a small module.
- [ ] `searchTextGlobal`: Search for "Paser Mini".
- [ ] `searchFilesPattern`: Search for `*.js`.

### 🌿 Version Control
- [ ] `gitDiff`: Diff `package.json`.
- [ ] `restoreFile`: Restore a modified test file.
- [ ] `gitDiffAll`: List all changes.
- [ ] `getCurrentRepo`: Retrieve repo name.

### 🧠 Memory & Context
- [ ] `pushMemory`: Store a test insight.
- [ ] `getTokenCount`: Retrieve current token usage.

### ⚡ JSON Intelligence
- [ ] `validateJson`: Validate a simple JSON string.
- [ ] `getJsonStructure`: Get structure of `package.json`.
- [ ] `getJsonNode`: Get a specific node from `package.json`.
- [ ] `getJsonArrayInfo`: Get info on a JSON array.
- [ ] `updateJsonNode`: Update a value in a test JSON file.

### 🐙 GitHub Integration
- [ ] `listIssues`: List issues for the current repo.
- [ ] `createIssue`: Create a test issue.
- [ ] `editIssue`: Edit the test issue.
- [ ] `closeIssue`: Close the test issue.
- [ ] `postComment`: Post a comment on an issue.

### ⚙️ System & Utilities
- [ ] `executeBash`: Run `ls -la`.
- [ ] `setNickname`: Change agent nickname.
- [ ] `notifyUser`: Send a system notification.
- [ ] `getTrackedFiles`: List project file tree.

### 🛠️ Specialized Tools
- [ ] `insertSceneFountain`: Insert a test scene.
- [ ] `loadZip`: Load a test ZIP file.
- [ ] `readZipFile`: Read a file from the ZIP.
- [ ] `writeZipFile`: Write a file to the ZIP.
- [ ] `saveZip`: Save the ZIP to disk.
- [ ] `listZipFiles`: List files in the ZIP.
- [ ] `binaryAnalysis`: Analyze a small binary file.

## Success Criteria
All tools must return a success status or a meaningful non-systemic response. Any `ERR` related to tool implementation (and not user input) is marked as a failure.