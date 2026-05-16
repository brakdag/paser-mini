# 🛠️ Paser Mini: Technical Tool Reference

This document provides a comprehensive specification of all tools available to the agent. To maintain zero-friction execution, always use the most surgical tool available for the task.

---

## 📁 File System & Navigation

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `readFile` | Reads file content. Use `tail` for large files. | `path` (str), `tail` (num) | ✅ Stable |
| `writeFile` | Writes content to a file. | `path` (str), `content` (str) | ✅ Stable |
| `removeFile` | Deletes a file. | `path` (str) | ✅ Stable |
| `listDir` | Lists directory contents. | `path` (str) | ✅ Stable |
| `renamePath` | Moves or renames a path. | `origin` (str), `destination` (str) | ✅ Stable |
| `copyFile` | Duplicates a file. | `origin` (str), `destination` (str) | ✅ Stable |
| `concatFile` | Appends source file to destination. | `destination` (str), `source` (str) | ✅ Stable |
| `replaceString` | Search and replace text. | `path` (str), `search_text` (str), `replace_text` (str) | ⚠️ **UNSTABLE** |

> 🚨 **CRITICAL NOTE on `replaceString` (sed):** This tool is currently experiencing systemic failures (`ERR: Search text cannot be empty`). 
> **Safe Alternative Workflow:** `readFile` $\rightarrow$ Local string replacement $\rightarrow$ `writeFile`.

---

## 🔍 Search & Analysis

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `analyzeCode` | Static analysis for JS/TS errors. | `path` (str) | ✅ Stable |
| `lintCode` | Runs ESLint analysis. | `path` (str) | ✅ Stable |
| `generateDocs` | Generates HTML docs via JSDoc. | `path` (str), `outputDir` (str) | ✅ Stable |
| `searchTextGlobal` | Global string search across all files. | `query` (str) | ✅ Stable |
| `searchFilesPattern` | Finds files matching a pattern. | `pattern` (str) | ✅ Stable |

---

## 🌿 Version Control (Git)

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `gitDiff` | Shows differences for a specific file. | `path` (str) | ✅ Stable |
| `restoreFile` | Restores file to previous git state. | `path` (str) | ✅ Stable |
| `gitDiffAll` | Shows all changes in the repository. | None | ✅ Stable |
| `getCurrentRepo` | Gets the current GitHub repo name. | None | ✅ Stable |

---

## 🧠 Cognitive Memory (Memento)

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `pushMemory` | Stores a distilled insight in `memento.log`. | `data` (str) | ✅ Stable |
| `getTokenCount` | Returns current token usage and %. | None | ✅ Stable |

---

## ⚡ JSON Intelligence

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `validateJson` | Checks if a string is valid JSON. | `json_string` (str) | ✅ Stable |
| `getJsonStructure` | Returns keys/structure of a JSON node. | `file_path` (str), `path` (str) | ✅ Stable |
| `getJsonNode` | Retrieves content of a specific JSON node. | `file_path` (str), `path` (str) | ✅ Stable |
| `getJsonArrayInfo` | Returns length and type of a JSON array. | `file_path` (str), `path` (str) | ✅ Stable |
| `updateJsonNode` | Updates a specific JSON node value. | `file_path` (str), `path` (str), `value` (any) | ✅ Stable |

---

## 🐙 GitHub Integration

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `listIssues` | Lists issues in a repository. | `repo` (str) | ✅ Stable |
| `createIssue` | Creates a new GitHub issue. | `title` (str), `body` (str), `repo` (str) | ✅ Stable |
| `editIssue` | Edits an existing GitHub issue. | `issue_number` (int), `repo` (str), `title` (str), `body` (str) | ✅ Stable |
| `closeIssue` | Closes a GitHub issue. | `issue_number` (int), `repo` (str) | ✅ Stable |
| `postComment` | Posts a comment to a GitHub issue. | `issue_number` (int), `body` (str) | ✅ Stable |

---

## ⚙️ System & Utilities

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `executeBash` | Runs a bash command in project root. | `command` (str) | ✅ Stable |
| `setNickname` | Changes agent's display nickname. | `newNickname` (str) | ✅ Stable |
| `notifyUser` | Sends a notification and plays sound. | `message` (str) | ✅ Stable |
| `getTrackedFiles` | Returns the project file tree. | None | ✅ Stable |

---

## 🛠️ Specialized Tools

| Tool | Description | Arguments | Status |
| :--- | :--- | :--- | :--- |
| `insertSceneFountain` | Inserts a Fountain scene into chat. | `scene` (str), `action` (str) | ✅ Stable |
| `loadZip` | Loads a ZIP file into memory. | `filePath` (str) | ✅ Stable |
| `readZipFile` | Reads a file within a loaded ZIP. | `zipId` (str), `internalPath` (str) | ✅ Stable |
| `writeZipFile` | Writes/updates a file within a ZIP. | `zipId` (str), `internalPath` (str), `content` (str) | ✅ Stable |
| `saveZip` | Saves a ZIP from RAM to disk. | `zipId` (str), `outputPath` (str) | ✅ Stable |
| `listZipFiles` | Lists files within a loaded ZIP. | `zipId` (str) | ✅ Stable |
| `binaryAnalysis` | Performs binary analysis on a file. | `action` (str), `filePath` (str), etc. | ✅ Stable |

---

## 🎯 Operational Standard

**The Surgical Rule:** Always prioritize the most specific tool. If you can use `updateJsonNode`, never use `writeFile`. Every token saved is reasoning capacity gained.