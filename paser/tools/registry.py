# WARNING: Refer to Issue #110 before editing this file.
# The SYSTEM_INSTRUCTION construction is mandatory to avoid interceptor issues.

import os
import json
from paser.tools import (
    file_tools as ft,
    web_tools as wt,
    system_tools as st,
    util_tools as ut,
    mqtt_tools as mt,
    discovery as disc,
    code_navigator as cn,
    wasm_tools as wt_wasm,
    vision as vt,
    git_tools as gt,
    github_tools as gh,
    api_tools as at,
    lsp_tools as lsp
)

# Initialize specialized navigators
nav = cn.CodeNavigator()

# Mapping of tool names to their executable Python functions
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
    "render_web_page": wt.render_web_page,
    "get_cwd": ut.get_cwd,
    "read_lines": ft.read_lines,
    "read_head": ft.read_head,
    "update_line": ft.update_line,
    "replace_string": ft.replace_string,
    "replace_function": ft.replace_function,
    "manage_imports": ft.manage_imports,

    "analyze_pyright": st.analyze_pyright,
    "replace_string_at_line": ft.replace_string_at_line,
    "search_text_global": ft.search_text_global,
    "search_files_pattern": ft.search_files_pattern,
    "rename_path": ft.rename_path,
    "create_dir": ft.create_dir,
    "notify_user": st.notify_user,
    "alert_sound": st.alert_sound,
    "set_timer": st.set_timer,
    "is_window_in_focus": st.is_window_in_focus,
    "convert_image": st.convert_image,
    "notify_mobile": mt.notify_mobile,
    "git_diff": gt.git_diff,
    "revert_file": gt.revert_file,
    "get_current_repo": gt.get_current_repo,
    "get_definition": nav.get_definition,
    "get_references": nav.get_references,
    "list_symbols": nav.list_symbols,
    "find_all_calls": nav.find_all_calls,
    "get_detailed_symbols": nav.get_detailed_symbols,
    "get_imports": nav.get_imports,
    "find_missing_type_hints": nav.find_missing_type_hints,
    "execute_python": wt_wasm.execute_python,
    "format_code": ft.format_code,
    "get_tree": ft.get_tree,
    "read_file_with_lines": ft.read_file_with_lines,
    "copy_lines": ft.copy_lines,
    "cut_lines": ft.cut_lines,
    "paste_lines": ft.paste_lines,
    "see_image": vt.see_image,
    "list_issues": gh.list_issues,
    "create_issue": gh.create_issue,
    "close_issue": gh.close_issue,
    "edit_issue": gh.edit_issue,
    "compile_latex": st.compile_latex,
    "play_music": st.play_music,
    "stop_music": st.stop_music,
    "speak_text": st.speak_text,
    "api_request": at.api_request,
    "query_ai": ut.query_ai,
    "get_lsp_completions": lsp.lsp_nav.get_lsp_completions,
    "get_object_methods": lsp.lsp_nav.get_object_methods,
    "validate_json": ut.validate_json,
    "validate_json_file": ut.validate_json_file
}

# Load tool definitions (descriptions and params) for the LLM prompt
_registry_path = os.path.join(os.path.dirname(__file__), "registry_positional.json")
with open(_registry_path, "r") as f:
    full_catalog = json.load(f)

TOOL_CATALOG = json.dumps(full_catalog, indent=2)

# Bypassing interceptor by fragmenting the forbidden strings
_S = chr(60) + "TOOL" + "_CALL" + chr(62)
_E = chr(60) + "/" + "TOOL" + "_CALL" + chr(62)

# Core system prompt defining agent behavior and tool interaction rules
SYSTEM_INSTRUCTION = (
    f"""
You are an autonomous agent.

Visual: Terminal uses Markdown + Nerd Fonts + glyphs + latex symbols.

Tool Catalog [Name, Description, {{Param:Type}}]:
{TOOL_CATALOG}

STRICT Rules:
1. Tool calls must use this exact JSON format:
[[S]]{{"name": "tool_name", "args": {{"arg": "value"}}}}[[E]]

2. Execution: Tool > <TOOL_RESPONSE> > Next Tool. Summary at end.

3. Apply linters and best practices to all languages.

4. Setup: Read AGENT.md and README.md first by default.

"""
    .replace("[[S]]", _S)
    .replace("[[E]]", _E)
)
