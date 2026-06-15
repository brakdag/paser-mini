# Minimal Toolset

This document serves as the definitive reference for the tools available to the Paser Mini agent. To maintain extreme lightness and token efficiency, tools are designed for surgical precision, avoiding bloated outputs and unnecessary context flooding.

### 📁 File System & Navigation
- **Reading**: `read`, `tree`.
- **Writing/Editing**: `write`, `replace`, `concat`.
- **Management**: `remove`, `rename`, `copy`, `restore`.
- **Navigation**: `list`.

### 🔍 Search & Analysis
- **Global Search**: `grep`, `glob`.
- **Code Intelligence**: `analysis`, `eslint`, `doc`, `ast`.

### 🧠 Memento (Cognitive Log)
**The Distillation Loop**: `read` $ightarrow$ Analyze $ightarrow$ `push` $ightarrow$ Forget file content $ightarrow$ `token` (future retrieval).

- **Capture**: `push(data)` - Appends an entry to `memento.log`.
- **Retrieval**: Use `read("memento.log")` for full raw access.

### ⚡ JSON Intelligence
- **Validation**: `valide`.
- **Structural Analysis**: `structure`, `arrange`.
- **Surgical Access**: `node`, `update`.

### 🐙 GitHub Integration
- **Issue Management**: `issues`, `create`, `edit`, `close`, `post`.
- **Repo Info**: `remote`.

### ⚙️ System & Utilities
- **Orchestration**: `execute`, `run`.
- **Agent State**: `nickname`, `reset`.
- **Communication**: `notify`.

### 🛠️ Specialized Tools
- **Content**: `scene`.
- **Archives**: `zip`.
- **Binary**: `bin`.
- **Web**: `search`, `url`.
- **Visual**: `img`.

### 🚀 Performance & Telemetry
- **Runtime Metrics**: `metrics`.
- **Memory Analysis**: `snapshot`.

---

**Constraint**: Always prioritize the most surgical tool. If you can use `update`, never use `write`. Every token saved is reasoning capacity gained.