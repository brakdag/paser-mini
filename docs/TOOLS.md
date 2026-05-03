# Minimal Toolset

This document serves as the definitive reference for the tools available to the Paser Mini agent. To maintain extreme lightness and token efficiency, tools are designed for surgical precision, avoiding bloated outputs and unnecessary context flooding.

### 📁 File System & Navigation

- **Reading**: `read_file` (content), `list_dir` (contents), `get_tree` (visual project structure).
- **Writing/Editing**: `write_file` (full rewrite), `replace_string` (surgical search/replace), `concat_file` (append source to destination).
- **Management**: `remove_file` (delete), `rename_path` (move/rename), `copy_file` (duplicate), `restore_file` (git restore).

### 🔍 Search & Analysis

- **Global Search**: `search_text_global` (content search), `search_files_pattern` (filename pattern).
- **Code Intelligence**: `analyze_pyright` (static analysis), `git_diff` (version control differences).

### 🧠 Memento (Cognitive Memory)

**The Distillation Loop**: `read_file` $\rightarrow$ Analyze $\rightarrow$ `push_memory` (distilled insight) $\rightarrow$ Forget file content $\rightarrow$ `pull_memory` (future retrieval).

- **Capture**: `push_memory(scope, value, key, pointers)` - Persist insights. Use `scope='tattoo'` for permanent project truths and `scope='fractal'` for general knowledge.
- **Retrieval**: `pull_memory(scope, key, direction)` - Access historical context, navigate the narrative (next/prev), or trigger the "Mirror Effect" (all vitals).

### 🛠️ Technical Execution

- **Python Sandbox**: `run_python` - Executes a Python script using the project venv. Runs in the script's directory.
- **Formatting**: `code_formatter` - Format Python code according to PEP 8 using black.
- **Orchestration**: `new_agent` - Launches a new independent instance of Paser Mini in the project root.
- **Metrics**: `get_token_count` - Returns current token usage and percentage relative to the limit.

### ⚡ JSON Intelligence

- **Validation**: `validate_json` - Checks if a string is valid JSON.
- **Structural Analysis**: `get_json_structure` (keys/structure), `get_json_array_info` (length/item type).
- **Surgical Access**: `get_json_node` (retrieve specific node), `update_json_node` (update specific node).

---
**Constraint**: Always prioritize the most surgical tool. If you can use `replace_string`, never use `write_file`. Every token saved is reasoning capacity gained.