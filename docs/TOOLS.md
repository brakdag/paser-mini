# Minimal Toolset

This document serves as the definitive reference for the tools available to the Paser Mini agent. To maintain extreme lightness and token efficiency, tools are designed for surgical precision, avoiding bloated outputs and unnecessary context flooding.

### 📁 File System & Navigation

- **Reading**: `readFile` (content), `listDir` (contents), `getTrackedFiles` (visual project structure).
- **Writing/Editing**: `writeFile` (full rewrite), `replaceString` (surgical search/replace), `concatFile` (append source to destination).
- **Management**: `removeFile` (delete), `renamePath` (move/rename), `copyFile` (duplicate), `restoreFile` (git restore).

### 🔍 Search & Analysis

- **Global Search**: `searchTextGlobal` (content search), `searchFilesPattern` (filename pattern).
- **Code Intelligence**: `analyzeCode` (static analysis for JS/TS codebase), `gitDiff` (version control differences).

### 🧠 Memento (Cognitive Log)

**The Distillation Loop**: `readFile` $\rightarrow$ Analyze $\rightarrow$ `pushMemory` (log entry) $\rightarrow$ Forget file content $\rightarrow$ `pullMemory` (future retrieval).

- **Capture**: `pushMemory(role, scope, value, key)` - Appends an entry to `memento.log` with a unique ID, timestamp, and initial `Rank: 0`. Use `scope='tattoo'` for core truths.
- **Retrieval**: `pullMemory(scope, key, direction)` - Retrieves memories based on scope and key. Use `readFile("memento.log")` for full raw access.

### 🛠️ Technical Execution

- **Orchestration**: `newAgent` - Launches a new independent instance of Paser Mini in the project root.
- **Metrics**: `getTokenCount` - Returns current token usage and percentage relative to the limit.

### ⚡ JSON Intelligence

- **Validation**: `validateJson` - Checks if a string is valid JSON.
- **Structural Analysis**: `getJsonStructure` (keys/structure), `getJsonArrayInfo` (length/item type).
- **Surgical Access**: `getJsonNode` (retrieve specific node), `updateJsonNode` (update specific node).

---
**Constraint**: Always prioritize the most surgical tool. If you can use `replaceString`, never use `writeFile`. Every token saved is reasoning capacity gained.