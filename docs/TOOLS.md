# Minimal Toolset

To maintain extreme lightness, only the absolute core tools are included:

### 📂 File System

- **Reading**: `read_file`.
- **Writing**: `write_file`, `remove_file`, `create_dir`, `rename_path`.
- **Navigation**: `list_dir`, `get_cwd`.

### ✂️ Basic Editing

- **Modification**: `replace_string` (Surgical text replacement).

### 🔍 Search & Analysis

- **Search**: `search_files_pattern`, `search_text_global`.
- **Analysis**: `analyze_pyright` (Static type checking).

### 🛠️ Core Utils

- **Validation**: `validate_json`.
- **Execution**: `run_instance` (Automatic Sandbox: `paser-mini` runs in `venv`, all other targets run in WebAssembly sandbox).