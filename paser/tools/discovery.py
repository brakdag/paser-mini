import json
import os
from typing import Optional, List, Dict, Any

# Mapping of tools to categories
TOOL_CATEGORIES = {
    "files": [
        "read_file", "read_files", "write_file", "remove_file", "list_dir", 
        "read_lines", "read_head", "update_line", "replace_text", "replace_block", 
        "replace_text_regex", "replace_block_regex", "global_replace", "global_search", 
        "glob_search", "rename_path", "make_dir"
    ],
    "web": ["web_search", "fetch_url"],
    "system": ["analyze_pyright", "notify_user", "set_timer", "is_window_in_focus"],
    "git": ["git_diff", "get_remote_repo"],
    "github": ["list_issues", "create_issue", "close_issue"],
    "vision": ["see_image"],
    "code": ["get_definition", "get_references", "list_symbols"],
    "python": ["execute_python"],
    "util": ["get_time", "get_cwd", "list_tools"],
    "mqtt": ["notify_mobile"],
}

def list_tools(category: Optional[str] = None) -> str:
    """
    Lists available tools. If no category is provided, returns a list of categories.
    If a category is provided, returns the detailed description and parameters of tools in that category.
    """
    catalog_path = os.path.join(os.path.dirname(__file__), "registry_positional.json")
    
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog = json.load(f)
    except Exception as e:
        return f"Error loading tool catalog: {str(e)}"

    if category is None:
        categories = sorted(list(TOOL_CATEGORIES.keys()))
        return f"Available tool categories: {', '.join(categories)}"

    category = category.lower()
    if category not in TOOL_CATEGORIES:
        return f"Category '{category}' not found. Available categories: {', '.join(sorted(list(TOOL_CATEGORIES.keys())))}"

    tools_in_category = TOOL_CATEGORIES[category]
    detailed_tools = []

    for tool_def in catalog:
        name, description, params = tool_def
        if name in tools_in_category:
            detailed_tools.append(f"- {name}: {description} | Params: {params}")

    if not detailed_tools:
        return f"No tools found in category '{category}'."

    return f"Tools in category '{category}':\n" + "\n".join(detailed_tools)
