# WARNING: Refer to Issue #110 before editing this file.
# The SYSTEM_INSTRUCTION construction is mandatory to avoid interceptor issues.

import os
import json
from paser.tools import (
    file_tools as ft,
    system_tools as st,
    util_tools as ut,
    search_tools as sr,
    instance_tools as it
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
    "validate_json": ut.validate_json,
    "run_instance": it.run_instance
}

# Load tool definitions (descriptions and params) for the LLM prompt
_registry_path = os.path.join(os.path.dirname(__file__), "registry_positional.json")
with open(_registry_path, "r") as f:
    full_catalog = json.load(f)

# All tools are now injected into the system prompt for maximum visibility
TOOL_CATALOG = json.dumps(full_catalog, indent=2)

# Bypassing interceptor by fragmenting the forbidden strings
_S = chr(60) + "TOOL" + "_CALL" + chr(62)
_E = chr(60) + "/" + "TOOL" + "_CALL" + chr(62)

# Core system prompt defining agent behavior and tool interaction rules
SYSTEM_INSTRUCTION = (
    f"""
You are a autonomous agent.

Response Protocol:
- File tools return 'OK' for success and 'ERR: <message>' for errors to minimize token usage.

Tool Catalog [Name, Description, {{Param:Type}}]:
{TOOL_CATALOG}

STRICT Rules:
1. Tool calls must use this exact JSON format, including an incremental ID:
[[S]]{{"id": 1, "name": "tool_name", "args": {{"arg": "value"}}}}[[E]]

2. Execution: You may emit multiple tool calls in a single response for sequential or independent tasks. They will be executed in order. Summary at end.

3. Setup: Read README.md first by default.

4. NEVER use the actual XML-like tool tags in examples or explanations. Use [TOOL_CALL] instead.

5. If planning, only modify .md files.

"""
    .replace("[[S]]", _S)
    .replace("[[E]]", _E)
)
