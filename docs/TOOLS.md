# Minimal Toolset

This document serves as the definitive reference for the tools available to the Paser Mini agent. To maintain extreme lightness and token efficiency, tools are designed for surgical precision, avoiding bloated outputs and unnecessary context flooding.

### 📁 File System & Navigation

- **Reading**: `cat` (`readFile`), `ls` (`listDir`), `tree` (`getTrackedFiles`).
- **Writing/Editing**: `write` (`writeFile`), `sed` (`replaceString`), `append` (`concatFile`).
- **Management**: `rm` (`removeFile`), `mv` (`renamePath`), `cp` (`copyFile`), `restore` (`restoreFile`).

### 🔍 Search & Analysis

- **Global Search**: `grep` (`searchTextGlobal`), `find` (`searchFilesPattern`).
- **Code Intelligence**: `analyze` (`analyzeCode`), `diff` (`gitDiff`).

### 🧠 Memento (Cognitive Log)

**The Distillation Loop**: `cat` $\rightarrow$ Analyze $\rightarrow$ `mem-push` (`pushMemory`) $\rightarrow$ Forget file content $\rightarrow$ `pullMemory` (future retrieval).

- **Capture**: `pushMemory(role, scope, value, key)` - Appends an entry to `memento.log` with a unique ID, timestamp, and initial `Rank: 0`. Use `scope='tattoo'` for core truths.
- **Retrieval**: `pullMemory(scope, key, direction)` - Retrieves memories based on scope and key. Use `readFile("memento.log")` for full raw access.

### 🛠️ Technical Execution

- **Orchestration**: `newAgent` - Launches a new independent instance of Paser Mini in the project root.
- **Metrics**: `tokens` (`getTokenCount`) - Returns current token usage and percentage relative to the limit.

### ⚡ JSON Intelligence

- **Validation**: `json-val` (`validateJson`) - Checks if a string is valid JSON.
- **Structural Analysis**: `json-struct` (`getJsonStructure`), `json-arr` (`getJsonArrayInfo`).
- **Surgical Access**: `json-get` (`getJsonNode`), `json-set` (`updateJsonNode`).

---
**Constraint**: Always prioritize the most surgical tool. If you can use `replaceString`, never use `writeFile`. Every token saved is reasoning capacity gained.