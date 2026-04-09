import os
from paser.tools import file_tools as ft
from paser.tools import web_tools as wt
from paser.tools import system_tools as st
from paser.tools import util_tools as ut
from paser.tools import mqtt_tools as mt
from paser.tools import discovery as disc
from paser.tools import code_navigator as cn
from paser.tools import wasm_tools as wt_wasm
from paser.tools import vision as vt
from paser.tools import git_tools as gt
from paser.tools import github_tools as gh

nav = cn.CodeNavigator()

AVAILABLE_TOOLS = {
    "get_time": ut.get_time,
    "list_tools": disc.list_tools,
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
    "replace_text_regex": ft.replace_text_regex,
    "replace_block_regex": ft.replace_block_regex,
    "analyze_pyright": st.analyze_pyright,
    "global_replace": ft.global_replace,
    "global_search": ft.global_search,
    "glob_search": ft.glob_search,
    "rename_path": ft.rename_path,
    "make_dir": ft.make_dir,
    "notify_user": st.notify_user,
    "alert_sound": st.alert_sound,
    "set_timer": st.set_timer,
    "set_timer": st.set_timer,
    "is_window_in_focus": st.is_window_in_focus,
    "notify_mobile": mt.notify_mobile,
    "git_diff": gt.git_diff,
    "revert_file": gt.revert_file,
    "get_current_repo": gt.get_current_repo,
    "get_definition": nav.get_definition,
    "get_references": nav.get_references,
    "list_symbols": nav.list_symbols,
    "execute_python": wt_wasm.execute_python,
    "see_image": vt.see_image,
    "list_issues": gh.list_issues,
    "create_issue": gh.create_issue,
    "close_issue": gh.close_issue,
    "edit_issue": gh.edit_issue
}

import json

with open(os.path.join(os.path.dirname(__file__), "registry_positional.json"), "r") as f:
    full_catalog = json.load(f)

TOOL_CATALOG = json.dumps(full_catalog, indent=2)

SYSTEM_INSTRUCTION = f"""
You are an autonomous agent.

Visual: Terminal uses Markdown + Nerd Fonts + glyphs.

Tool Catalog [Name, Description, {{Param:Type}}]:
{TOOL_CATALOG}

STRICT Rules:
1. Tool calls must use this exact JSON format:
<TOOL_CALL>{{"name": "tool_name", "args": {{"arg": "value"}}}}</TOOL_CALL>

2. Execution: Tool > <TOOL_RESPONSE> > Next Tool. Summary at end.

3. Apply linters and best practices to all languages.

4. Setup: Read AGENT.md, then README.md on demand.

"""


