from typing import Tuple, Dict

# Definición de metadatos de herramientas para desacoplar de ChatManager

FILE_TOOLS = {
    "read_file": ("Leyó", "󰈚"),
    "read_files": ("Leyó", "󰈚"),
    "write_file": ("Escribió", "󰈚"),
    "remove_file": ("Borró", "󰆵"),
    "update_line": ("Modificó", "󰈚"),
    "replace_string": ("Reemplazó", "󰑐"),
    "replace_code_block": ("Reemplazó (bloque)", "󰑐"),
    "replace_text_regex": ("Reemplazó (regex)", "󰑐"),
    "replace_block_regex": ("Reemplazó bloque (regex)", "󰑐"),
    "global_replace": ("Reemplazo global", "󰑐"),
    "read_head": ("Leyó (cabecera)", "󰈚"),
    "read_lines": ("Leyó (rango)", "󰈚"),
    "rename_path": ("Movió", "󰑐"),
    "create_dir": ("Creó", "󰉋"),
    "list_dir": ("Listó directorio", "󰉋"),
    "get_tree": ("Generó árbol", "󰉋"),
    "search_files_pattern": ("Buscó archivos", "󰍃"),
    "search_text_global": ("Buscó texto", "󰍃"),
}

NOTIFICATION_TOOLS = {
    "notify_user": ("Notificación", "󰋃"),
    "notify_mobile": ("Notificación móvil", "󰋃"),
}

TIMER_TOOLS = {
    "set_timer": ("Temporizador", "󰔟"),
}

SYSTEM_TOOLS = {
    "is_window_in_focus": ("Verificando foco", "󰇄"),
    "alert_sound": ("Reproduciendo sonido", "󰋃"),
    "convert_image": ("Convirtiendo imagen", "󰈚"),
}

COMPUTE_TOOLS = {
    "see_image": ("Analizando imagen", "󰍃"),
    "execute_python": ("Ejecutando Python", "󰈚"),
}

WEB_TOOLS = {
    "web_search": ("Buscando en la web", "󰍃"),
    "fetch_url": ("Obteniendo URL", "󰈚"),
}

GIT_TOOLS = {
    "git_diff": ("Analizando diff", "󰑐"),
    "revert_file": ("Revirtiendo archivo", "󰆵"),
    "get_current_repo": ("Obteniendo repo", "󰈚"),
}

GITHUB_TOOLS = {
    "list_issues": ("Listando issues", "󰍃"),
    "create_issue": ("Creando issue", "󰉋"),
    "close_issue": ("Cerrando issue", "󰆵"),
    "edit_issue": ("Editando issue", "󰑐"),
}

CODE_TOOLS = {
    "analyze_pyright": ("Analizando tipos", "󰈚"),
    "format_code": ("Formateando código", "󰑐"),
    "get_definition": ("Buscando definición", "󰍃"),
    "get_references": ("Buscando referencias", "󰍃"),
    "list_symbols": ("Listando símbolos", "󰈚"),
}

LATEX_TOOLS = {
    "compile_latex": ("Compilando LaTeX", "󰈚"),
}

UTIL_TOOLS = {
    "get_time": ("Obteniendo hora", "󰔟"),
    "list_tools": ("Listando herramientas", "󰍃"),
    "get_cwd": ("Obteniendo ruta", "󰉋"),
}

ALL_CATEGORIES = [
    FILE_TOOLS, COMPUTE_TOOLS, TIMER_TOOLS, SYSTEM_TOOLS, NOTIFICATION_TOOLS,
    WEB_TOOLS, GIT_TOOLS, GITHUB_TOOLS, CODE_TOOLS, LATEX_TOOLS, UTIL_TOOLS
]

def get_tool_metadata(tool_name: str) -> Tuple[str, str]:
    """Busca el verbo e icono de una herramienta en todas las categorías disponibles."""
    for cat in ALL_CATEGORIES:
        if tool_name in cat:
            return cat[tool_name]
    return ("Ejecutando", "󰍃")
