# WARNING: Refer to Issue #110 before editing this file.
# The SYSTEM_INSTRUCTION construction is mandatory to avoid interceptor issues.

import os
import json
from src.tools import (
    file_tools as ft,
    system_tools as st,
    util_tools as ut,
    search_tools as sr,
    instance_tools as it,
    memory_tools as mt
)

# Mapping of tool names to their executable Python functions
AVAILABLE_TOOLS = {
    "read_file": ft.read_file,
    "write_file": ft.write_file,
    "remove_file": ft.remove_file,
    "list_dir": ft.list_dir,
    "replace_string": ft.replace_string,
    "analyze_pyright": st.analyze_pyright,
    "search_text_global": sr.search_text_global,
    "search_files_pattern": sr.search_files_pattern,
    "rename_path": ft.rename_path,
    "copy_file": ft.copy_file,
    "get_tree": ft.get_tree,
    "validate_json": ut.validate_json,
    "run_python": it.run_python,
    "new_agent": it.new_agent,
    "push_memory": mt.push_memory,
    "pull_memory": mt.pull_memory,
    "get_token_count": mt.get_token_count,
    "git_diff": ft.git_diff,
    "restore_file": ft.restore_file,
    "code_formatter": ft.code_formatter,
    "concat_file": ft.concat_file
}

# Load tool definitions (descriptions and params) for the LLM prompt
_registry_path = os.path.join(os.path.dirname(__file__), "registry_positional.json")
with open(_registry_path, "r") as f:
    full_catalog = json.load(f)

# All tools are now injected into the system prompt for maximum visibility
TOOL_CATALOG = "\n".join([f"{t[0]}({', '.join(t[2].keys())}) - {t[1]}" for t in full_catalog])

# Bypassing interceptor by fragmenting the forbidden strings
_S = chr(60) + "TOOL" + "_CALL" + chr(62)
_E = chr(60) + "/" + "TOOL" + "_CALL" + chr(62)

# Core system prompt defining agent behavior and tool interaction rules
SYSTEM_INSTRUCTION = (
    f"""
You are a autonomous agent.

Response Protocol:
- File tools return 'OK' for success and 'ERR: <message>' for errors to minimize token usage.

Tool Catalog: name_tool(args) - description
{TOOL_CATALOG}

Tool Usage Guidelines:
- File Manipulation:
  - Copying: Use copy_file for duplication. Trust the tool's success response; do not verify with read_file unless an error occurs.
  - Editing: Use replace_string for surgical changes. Only use write_file for new files or full rewrites.
  - If replace_string fails: Use the tool's fuzzy suggestion or expand context to ensure uniqueness.


STRICT Rules:
1. Tool calls must use this exact JSON format, including an incremental ID:
[[S]]{{"id": 1, "name": "tool_name", "args": {{"arg": "value"}}}}[[E]]

2. Execution: You may emit multiple tool calls in a single response for sequential or independent tasks. They will be executed in order. Summary at end.

3. Use escaping instead of markdown triple backticks for code to ensure JSON integrity, and let the agent handle all code implementation directly.

4. If planning, only modify .md files.

5. Setup: Read ./README.md first by default.

6. Do not output internal reasoning, thought processes, or multiple response options. Deliver only the final answer or the tool calls.

7. You lost some memory, but thankfully you have the tools to get it back.

8. CRITICAL: Inside <TOOL_CALL> tags, you must output ONLY the JSON object. No text, no 'Thought:', no markdown, no explanations. Any text outside the JSON object inside the tags will break the system.
"""
    .replace("[[S]]", _S)
    .replace("[[E]]", _E)
)
