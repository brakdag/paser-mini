# 🛠️ Paser Mini: Technical Tool Reference

This document provides a comprehensive specification of all tools available to the agent. To maintain zero-friction execution, always use the most surgical tool available for the task.

---

## 📁 File System & Navigation

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `read` | Reads file content. Use `tail` for large files. | `path` (str), `tail` (num) |
| `write` | Writes content to a file. | `path` (str), `content` (str) |
| `remove` | Deletes a file. | `path` (str) |
| `list` | Lists directory contents. | `path` (str) |
| `replace` | Search and replace text. | `path` (str), `search_text` (str), `replace_text` (str) |
| `rename` | Moves or renames a path. | `origin` (str), `destination` (str) |
| `copy` | Duplicates a file. | `origin` (str), `destination` (str) |
| `concat` | Appends source file to destination. | `destination` (str), `source` (str) |
| `tree` | Returns the project file tree. | None |
| `restore` | Restores file to previous git state. | `path` (str) |

---

## 🔍 Search & Analysis

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `analysis` | Static analysis for JS/TS errors. | `path` (str) |
| `eslint` | Runs ESLint analysis. | `path` (str) |
| `doc` | Generates HTML docs via JSDoc. | `path` (str), `outputDir` (str) |
| `grep` | String search across files (scoped or global). | `query` (str), `path` (str, optional) |
| `glob` | Finds files matching a pattern. | `pattern` (str) |
| `ast` | Structural AST analysis. | `path` (str), `query` (str) |

---

## 🌿 Version Control (Git)

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `diff` | Shows differences for a specific file. | `path` (str) |

| `patch` | Apply a git patch. | `patch` (str) |
| `remote` | Gets the current GitHub repo name. | None |

---

## 🧠 Memory & Telemetry

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `push` | Stores a distilled insight in `memento.log`. | `data` (str) |
| `token` | Returns current token usage and %. | None |
| `metrics` | Current process memory and CPU usage. | None |
| `snapshot` | Creates a V8 heap snapshot. | `path` (str) |

---

## ⚡ JSON Intelligence

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `valide` | Checks if a string is valid JSON. | `json_string` (str) |
| `structure` | Returns keys/structure of a JSON node. | `file_path` (str), `path` (str) |
| `node` | Retrieves content of a specific JSON node. | `file_path` (str), `path` (str) |
| `arrange` | Returns length and type of a JSON array. | `file_path` (str), `path` (str) |
| `update` | Updates a specific JSON node value. | `file_path` (str), `path` (str), `value` (any) |

---

## 🐙 GitHub Integration

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `issues` | Lists issues in a repository. | `repo` (str) |
| `create` | Creates a new GitHub issue. | `title` (str), `body` (str), `repo` (str) |
| `edit` | Edits an existing GitHub issue. | `issue_number` (int), `repo` (str), `title` (str), `body` (str) |
| `close` | Closes a GitHub issue. | `issue_number` (int), `repo` (str) |
| `post` | Posts a comment to a GitHub issue. | `issue_number` (int), `body` (str), `repo` (str) |

---

## ⚙️ System & Utilities

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `execute` | Runs a bash command in project root. | `command` (str) |
| `nickname` | Changes agent's display nickname. | `newNickname` (str) |
| `notify` | Sends a notification and plays sound. | `message` (str) |
| `reset` | Resets the conversation context. | `user_message` (str) |
| `real` | Executes a high-privilege system action. | `action` (str) |
| `run` | Execute raw JavaScript in a secure sandbox. | `code` (str) |

---

## 🛠️ Specialized Tools

| Tool | Description | Arguments |
| :--- | :--- | :--- |
| `scene` | Inserts a Fountain scene into chat. | `scene` (str), `action` (str) |
| `zip` | Lists all files in a ZIP archive. | `filePath` (str) |
| `bin` | Performs binary analysis on a file. | `action` (str), `filePath` (str), etc. |
| `search` | Search the web using DuckDuckGo Lite. | `query` (str) |
| `url` | Render a webpage to text using elinks. | `url` (str) |
| `img` | Visualizes an image. | `path` (str) |

---

## 🎯 Operational Standard

**The Surgical Rule:** Always prioritize the most specific tool. If you can use `update`, never use `write`. Every token saved is reasoning capacity gained.