# Minimal Toolset

This document serves as the definitive reference for the tools available to the agent. To maintain extreme lightness and token efficiency, tools are designed for surgical precision.

### 📁 File System & Navigation

- **Reading**: `read_file`, `read_files` (batch), `read_lines` (range), `read_head` (first N lines), `read_file_with_lines` (with line numbers).
- **Writing/Editing**: `write_file` (full rewrite), `replace_string` (surgical), `replace_string_at_line` (precise), `insert_after`, `insert_before`, `update_line`.
- **Management**: `remove_file`, `rename_path`, `create_dir`, `revert_file` (git restore).
- **Navigation**: `list_dir`, `get_tree` (visual structure), `get_cwd`.

### 🔍 Search & Analysis

- **Global Search**: `search_text_global` (content), `search_files_pattern` (filenames).
- **Code Intelligence**: `analyze_pyright` (static analysis), `get_definition`, `get_references`, `list_symbols`, `get_detailed_symbols`, `get_imports`, `find_all_calls`, `get_object_methods`.
- **Version Control**: `git_diff`, `get_current_repo`.

### 🧠 Memento (Cognitive Memory)

**The Distillation Loop**: `read_file` $\rightarrow$ Analyze $\rightarrow$ `push_memory` (distilled insight) $\rightarrow$ Forget file content $\rightarrow$ `pull_memory` (future retrieval).

- **Capture**: `push_memory(scope, value, key, pointers)` - Persist insights. Use `scope='tattoo'` for permanent project truths.
- **Retrieval**: `pull_memory(scope, key, direction)` - Access historical context, navigate the narrative (next/prev), or trigger the "Mirror Effect" (all vitals).

### 🛠️ Technical Execution

- **Python Sandbox**: `execute_python` - Run isolated code. **Note**: No access to local files; use file tools for disk I/O.
- **Formatting**: `format_code` - Apply Black formatting to Python files.
- **Imports**: `manage_imports` - Semantic addition/removal of Python imports.

### 🌐 External Integration

- **Web**: `web_search`, `fetch_url`, `render_web_page` (clean text).
- **API**: `api_request` (GET, POST, PUT, DELETE, PATCH).
- **AI**: `query_ai` - Get a second opinion or break reasoning loops.
- **Automation**: `playwright_execute` (stealth browser), `network_intercept`, `proxy_rotate`.

### ⚡ System & Utility

- **JSON**: `validate_json`, `validate_json_file`.
- **Notifications**: `notify_user`, `notify_mobile`, `alert_sound`.
- **Misc**: `get_utc_time`, `set_timer`, `speak_text`, `compile_latex`, `play_music`.

--- 
**Constraint**: Always prioritize the most surgical tool. If you can use `replace_string`, never use `write_file`.