# Minimal Toolset

To maintain extreme lightness, only the absolute core tools are included.

### 📁 File System

- **Reading/Writing**: `read_file`, `write_file`, `remove_file`, `copy_file`, `concat_file`.
- **Management**: `rename_path`, `restore_file` (via git restore).
- **Navigation**: `list_dir`, `get_tree` (fast directory tree).

### ✒️ Editing & Formatting

- **Modification**: `replace_string` (Surgical text replacement).
- **Formatting**: `code_formatter` (PEP 8 compliance via black).

### 🔍 Search & Analysis

- **Search**: `search_text_global`, `search_files_pattern`.
- **Analysis**: `analyze_pyright` (Static type checking), `git_diff` (Show file differences).

### 🧠 Memento (Memory)

- **Capture**: `push_memory(scope, value, key, pointers)` - Persist insights, tattoos, or fractals.
- **Retrieval**: `pull_memory(scope, key, direction)` - Access historical context or the "Mirror Effect".

### 💎 JSON Manipulation

- **Structure**: `get_json_structure(file_path, path)` - Inspect the schema of a JSON node.
- **Access**: `get_json_node(file_path, path)` - Retrieve specific content from a JSON path.
- **Array Info**: `get_json_array_info(file_path, path)` - Get length and type of a JSON array.
- **Update**: `update_json_node(file_path, path, value)` - Surgical updates to JSON data.
- **Validation**: `validate_json(json_string)` - Ensure JSON integrity.

### 🛠️ Core Utils

- **Execution**: `run_python` (Execute scripts in the Paser venv), `run_instance` (Automatic Sandbox).
- **Agent Management**: `new_agent` (Launch an independent instance).
- **Verification**: `verify_implementation` (Smoke tests and custom verification).
- **Monitoring**: `get_token_count` (Track context usage).