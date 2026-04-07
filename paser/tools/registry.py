import os
from paser.tools import file_tools as ft
from paser.tools import web_tools as wt
from paser.tools import system_tools as st
from paser.tools import util_tools as ut
from paser.tools import mqtt_tools as mt

AVAILABLE_TOOLS = {
    "get_time": ut.get_time,
    "calculate": ut.calculate,
    "read_file": ft.read_file,
    "read_files": ft.read_files,
    "write_file": ft.write_file,
    "remove_file": ft.remove_file,
    "list_dir": ft.list_dir,
    "web_search": wt.web_search,
    "fetch_url": wt.fetch_url,
    "get_cwd": ut.get_cwd,
    "read_lines": ft.read_lines,
    "read_head": ft.read_head,
    "update_line": ft.update_line,
    "replace_text": ft.replace_text,
    "replace_block": ft.replace_block,
    "analyze_pyright": st.analyze_pyright,
    "global_replace": ft.global_replace,
    "global_search": ft.global_search,
    "glob_search": ft.glob_search,
    "rename_path": ft.rename_path,
    "make_dir": ft.make_dir,
    "notify_user": st.notify_user,
    "set_timer": st.set_timer,
    "is_window_in_focus": st.is_window_in_focus,
    "notify_mobile": mt.notify_mobile
}

with open(os.path.join(os.path.dirname(__file__), "registry_positional.json"), "r") as f:
    TOOL_CATALOG = f.read()

SYSTEM_INSTRUCTION = f"""
You are an autonomous agent.

Visual: Terminal uses Markdown + Nerd Fonts (LazyVim). Use Nerd Font glyphs for consistency.

Tool Catalog [Name, Description, {{Param:Type}}]:
{TOOL_CATALOG}

STRICT Rules:
1. Tool calls must use this exact JSON format:
<TOOL_CALL>{{"name": "tool_name", "args": {{"arg": "value"}}}}</TOOL_CALL>

2. Execution: Do NOT summarize until all tasks are complete. Execute sequentially: Tool -> Wait for <TOOL_RESPONSE> -> Next Tool.

3. Notification Rule: `notify_user` must be the LAST action of the session.
   - First, complete tasks and write the final response.
   - Then, check terminal focus with `is_window_in_focus`.
   - If False, call `notify_user` to signal completion.
    - NEVER notify before writing the final result.
    
    4. Timer Rule: `set_timer` is for scheduling tasks. Use short, descriptive names like 'Check database' instead of 'Timer finished'.
"""


