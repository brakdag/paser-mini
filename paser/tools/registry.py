from paser.tools import file_tools as ft
from paser.tools import web_tools as wt
from paser.tools import system_tools as st
from paser.tools import util_tools as ut

AVAILABLE_TOOLS = {
    "obtener_hora_actual": ut.obtener_hora_actual,
    "calculadora_basica": ut.calculadora_basica,
    "leer_archivo": ft.leer_archivo,
    "escribir_archivo": ft.escribir_archivo,
    "borrar_archivo": ft.borrar_archivo,
    "listar_archivos": ft.listar_archivos,
    "buscar_en_internet": wt.buscar_en_internet,
    "leer_url": wt.leer_url,
    "obtener_directorio_actual": ut.obtener_directorio_actual,
    "leer_lineas": ft.leer_lineas,
    "leer_cabecera": ft.leer_cabecera,
    "modificar_linea": ft.modificar_linea,
    "reemplazar_texto": ft.reemplazar_texto,
    "reemplazar_bloque_texto": ft.reemplazar_bloque_texto,
    "analizar_codigo_con_pyright": st.analizar_codigo_con_pyright,
    "buscar_reemplazar_global": ft.buscar_reemplazar_global,
    "mover_archivo": ft.mover_archivo,
    "crear_carpeta": ft.crear_carpeta
}

TOOL_CATALOG = """
[
    {"name": "obtener_hora_actual", "description": "Obtiene la hora actual.", "parameters": {"type": "object", "properties": {"zona_horaria": {"type": "string"}}, "required": ["zona_horaria"]}},
    {"name": "calculadora_basica", "description": "Evalúa operación matemática.", "parameters": {"type": "object", "properties": {"operacion": {"type": "string"}}, "required": ["operacion"]}},
    {"name": "leer_archivo", "description": "Lee archivo.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "escribir_archivo", "description": "Escribe archivo.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "contenido": {"type": "string"}}, "required": ["path", "contenido"]}},
    {"name": "borrar_archivo", "description": "Borra archivo.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "listar_archivos", "description": "Lista archivos.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "buscar_en_internet", "description": "Busca en internet.", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "leer_url", "description": "Lee URL.", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}},
    {"name": "obtener_directorio_actual", "description": "Obtiene el directorio actual de trabajo.", "parameters": {"type": "object", "properties": {}}},
    {"name": "leer_lineas", "description": "Lee rango de líneas.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "inicio": {"type": "integer"}, "fin": {"type": "integer"}}, "required": ["path", "inicio", "fin"]}},
    {"name": "leer_cabecera", "description": "Lee primeras líneas.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "cantidad_lineas": {"type": "integer"}}, "required": ["path", "cantidad_lineas"]}},
    {"name": "modificar_linea", "description": "Modifica el contenido de una línea específica en un archivo indicando el número de línea (1-indexed).", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "numero_linea": {"type": "integer"}, "nuevo_contenido": {"type": "string"}}, "required": ["path", "numero_linea", "nuevo_contenido"]}},
    {"name": "reemplazar_texto", "description": "Busca todas las ocurrencias de 'texto_buscar' en un archivo y las reemplaza por 'texto_reemplazar'.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "texto_buscar": {"type": "string"}, "texto_reemplazar": {"type": "string"}}, "required": ["path", "texto_buscar", "texto_reemplazar"]}},
    {"name": "reemplazar_bloque_texto", "description": "Busca un bloque de texto exacto y lo reemplaza por otro. Útil para cambios quirúrgicos de varias líneas.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "texto_buscar": {"type": "string"}, "texto_reemplazar": {"type": "string"}}, "required": ["path", "texto_buscar", "texto_reemplazar"]}},
    {"name": "analizar_codigo_con_pyright", "description": "Analiza código con pyright y devuelve errores si existen.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": []}},
    {"name": "buscar_reemplazar_global", "description": "Busca y reemplaza una cadena de texto en múltiples archivos dentro de un directorio.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "texto_buscar": {"type": "string"}, "texto_reemplazar": {"type": "string"}, "extensiones": {"type": "array", "items": {"type": "string"}}}, "required": ["path", "texto_buscar", "texto_reemplazar"]}},
    {"name": "mover_archivo", "description": "Mueve o renombra un archivo o directorio de 'origen' a 'destino'. Si el directorio destino no existe, se crea.", "parameters": {"type": "object", "properties": {"origen": {"type": "string"}, "destino": {"type": "string"}}, "required": ["origen", "destino"]}},
    {"name": "crear_carpeta", "description": "Crea un directorio (incluyendo directorios padres si es necesario).", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}
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
