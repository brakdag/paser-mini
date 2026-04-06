from paser.tools import file_tools as ft
from paser.tools import web_tools as wt
from paser.tools import system_tools as st
from paser.tools import util_tools as ut

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
    "rename_path": ft.rename_path,
    "make_dir": ft.make_dir,
    "notify_user": st.notify_user
}

TOOL_CATALOG = """
[
    {"name": "get_time", "description": "Obtiene la hora actual.", "parameters": {"type": "object", "properties": {"zona_horaria": {"type": "string"}}, "required": ["zona_horaria"]}},
    {"name": "calculate", "description": "Evalúa operación matemática.", "parameters": {"type": "object", "properties": {"operacion": {"type": "string"}}, "required": ["operacion"]}},
    {"name": "read_file", "description": "Lee archivo.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "read_files", "description": "Lee varios archivos a la vez.", "parameters": {"type": "object", "properties": {"paths": {"type": "array", "items": {"type": "string"}}}, "required": ["paths"]}},
    {"name": "write_file", "description": "Escribe archivo.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "contenido": {"type": "string"}}, "required": ["path", "contenido"]}},
    {"name": "remove_file", "description": "Borra archivo.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "list_dir", "description": "Lista archivos.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "web_search", "description": "Busca en internet.", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "fetch_url", "description": "Lee URL.", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}},
    {"name": "get_cwd", "description": "Obtiene el directorio actual de trabajo.", "parameters": {"type": "object", "properties": {}}},
    {"name": "read_lines", "description": "Lee rango de líneas.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "inicio": {"type": "integer"}, "fin": {"type": "integer"}}, "required": ["path", "inicio", "fin"]}},
    {"name": "read_head", "description": "Lee primeras líneas.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "cantidad_lineas": {"type": "integer"}}, "required": ["path", "cantidad_lineas"]}},
    {"name": "update_line", "description": "Modifica el contenido de una línea específica en un archivo indicando el número de línea (1-indexed).", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "numero_linea": {"type": "integer"}, "nuevo_contenido": {"type": "string"}}, "required": ["path", "numero_linea", "nuevo_contenido"]}},
    {"name": "replace_text", "description": "Busca todas las ocurrencias de 'texto_buscar' en un archivo y las reemplaza por 'texto_reemplazar'.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "texto_buscar": {"type": "string"}, "texto_reemplazar": {"type": "string"}}, "required": ["path", "texto_buscar", "texto_reemplazar"]}},
    {"name": "replace_block", "description": "Busca un bloque de texto exacto y lo reemplaza por otro. Útil para cambios quirúrgicos de varias líneas.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "texto_buscar": {"type": "string"}, "texto_reemplazar": {"type": "string"}}, "required": ["path", "texto_buscar", "texto_reemplazar"]}},
    {"name": "analyze_pyright", "description": "Analiza código con pyright y devuelve errores si existen.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": []}},
    {"name": "global_replace", "description": "Busca y reemplaza una cadena de texto en múltiples archivos dentro de un directorio.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "texto_buscar": {"type": "string"}, "texto_reemplazar": {"type": "string"}, "extensiones": {"type": "array", "items": {"type": "string"}}}, "required": ["path", "texto_buscar", "texto_reemplazar"]}},
    {"name": "rename_path", "description": "Mueve o renombra un archivo o directorio de 'origen' a 'destino'. Si el directorio destino no existe, se crea.", "parameters": {"type": "object", "properties": {"origen": {"type": "string"}, "destino": {"type": "string"}}, "required": ["origen", "destino"]}},
    {"name": "make_dir", "description": "Crea un directorio (incluyendo directorios padres si es necesario).", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "notify_user", "description": "Triggers a system notification with a Nerd Font bell icon and a specific sound alert.", "parameters": {"type": "object", "properties": {"mensaje": {"type": "string", "description": "The notification text to be displayed to the user."}}, "required": ["mensaje"]}}
]
"""

SYSTEM_INSTRUCTION = f"""
Eres un agente autónomo.
Catálogo: {TOOL_CATALOG}

Regla ESTRICTA:
Todas las llamadas a herramientas deben seguir este formato JSON exacto:
<TOOL_CALL>{{"name": "nombre_herramienta", "args": {{"nombre_parametro": "valor"}}}}</TOOL_CALL>

No resumas NADA hasta que hayas terminado de usar TODAS las herramientas necesarias. Si necesitas hacer varias tareas, ejecuta una, espera <TOOL_RESPONSE>, y ejecuta la siguiente.
"""
