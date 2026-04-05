import os
import json
import tempfile
import logging
from .core_tools import get_safe_path

logger = logging.getLogger("tools")

FILE_SIZE_LIMIT = 5 * 1024 * 1024

def leer_archivo(path: str) -> str:
    try:
        safe_path = get_safe_path(path)
        if not os.path.isfile(safe_path):
            return f"Error: Archivo no encontrado en '{path}'."
        
        file_size = os.path.getsize(safe_path)
        if file_size > FILE_SIZE_LIMIT:
            return f"Error: El archivo '{path}' es demasiado grande ({file_size / 1024 / 1024:.2f} MB). El límite es {FILE_SIZE_LIMIT / 1024 / 1024:.2f} MB."
        
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if not content:
                return f"El archivo '{path}' está vacío."
            return content
    except Exception as e:
        logger.error(f"Error en leer_archivo {path}: {e}")
        return f"Error: {e}"

def escribir_archivo(path: str, contenido: str) -> str:
    try:
        safe_path = get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        if directorio:
            os.makedirs(directorio, exist_ok=True)
        
        fd, temp_path = tempfile.mkstemp(dir=directorio, text=True)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                f.write(contenido)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, safe_path)
            logger.info(f"Archivo '{path}' escrito exitosamente.")
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise
        return f"Archivo '{path}' creado/actualizado exitosamente."
    except PermissionError:
        logger.error(f"Error de permisos al escribir en '{path}'")
        return f"Error: No tengo permisos para escribir en '{path}'."
    except OSError as e:
        logger.error(f"Error de sistema al escribir en '{path}': {e}")
        return f"Error de sistema al escribir en '{path}': {e}"
    except Exception as e:
        logger.error(f"Error inesperado al escribir en '{path}': {e}")
        return f"Error inesperado: {e}"

def borrar_archivo(path: str) -> str:
    try:
        safe_path = get_safe_path(path)
        if not os.path.isfile(safe_path):
            return f"Error: Archivo no encontrado."
        os.remove(safe_path)
        logger.info(f"Archivo '{path}' borrado.")
        return f"Archivo '{path}' borrado exitosamente."
    except Exception as e:
        logger.error(f"Error al borrar archivo {path}: {e}")
        return f"Error: {e}"

def listar_archivos(path: str = ".") -> str:
    try:
        safe_path = get_safe_path(path)
        if not os.path.isdir(safe_path):
            return f"Error: '{path}' no es un directorio válido."
        return json.dumps(os.listdir(safe_path))
    except Exception as e:
        logger.error(f"Error al listar archivos en {path}: {e}")
        return f"Error: {e}"

def leer_lineas(path: str, inicio: int, fin: int) -> str:
    try:
        safe_path = get_safe_path(path)
        resultado = []
        with open(safe_path, 'r', encoding='utf-8') as f:
            for i, linea in enumerate(f, 1):
                if i >= inicio and i <= fin:
                    resultado.append(linea)
                if i > fin:
                    break
        return "".join(resultado)
    except Exception as e:
        logger.error(f"Error en leer_lineas {path}: {e}")
        return f"Error: {e}"

def leer_cabecera(path: str, cantidad_lineas: int) -> str:
    return leer_lineas(path, 1, cantidad_lineas)

def modificar_linea(path: str, numero_linea: int, nuevo_contenido: str) -> str:
    try:
        safe_path = get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        fd, temp_path = tempfile.mkstemp(dir=directorio, text=True)
        linea_encontrada = False
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as temp_file:
                with open(safe_path, 'r', encoding='utf-8') as original_file:
                    for i, line in enumerate(original_file, 1):
                        if i == numero_linea:
                            temp_file.write(nuevo_contenido + "\n")
                            linea_encontrada = True
                        else:
                            temp_file.write(line)
            if linea_encontrada:
                os.replace(temp_path, safe_path)
                return f"Línea {numero_linea} modificada."
            else:
                os.remove(temp_path)
                return "Error: Número de línea fuera de rango."
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise
    except Exception as e:
        logger.error(f"Error en modificar_linea {path}: {e}")
        return f"Error: {e}"

def reemplazar_texto(path: str, texto_buscar: str, texto_reemplazar: str) -> str:
    try:
        safe_path = get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        fd, temp_path = tempfile.mkstemp(dir=directorio, text=True)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as temp_file:
                with open(safe_path, 'r', encoding='utf-8') as original_file:
                    for line in original_file:
                        temp_file.write(line.replace(texto_buscar, texto_reemplazar))
            os.replace(temp_path, safe_path)
            return "Reemplazo completado."
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise
    except Exception as e:
        logger.error(f"Error en reemplazar_texto {path}: {e}")
        return f"Error: {e}"

def reemplazar_bloque_texto(path: str, texto_buscar: str, texto_reemplazar: str) -> str:
    try:
        safe_path = get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if texto_buscar not in content:
            return f"Error: El bloque de texto no se encontró."
        new_content = content.replace(texto_buscar, texto_reemplazar, 1)
        fd, temp_path = tempfile.mkstemp(dir=directorio, text=True)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as temp_file:
                temp_file.write(new_content)
                temp_file.flush()
                os.fsync(temp_file.fileno())
            os.replace(temp_path, safe_path)
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise
        return "Bloque de texto reemplazado exitosamente."
    except Exception as e:
        logger.error(f"Error en reemplazar_bloque_texto {path}: {e}")
        return f"Error: {e}"

def buscar_reemplazar_global(path: str, texto_buscar: str, texto_reemplazar: str, extensiones: list = None) -> str:
    try:
        safe_base_path = get_safe_path(path)
        if not os.path.isdir(safe_base_path):
             return f"Error: '{path}' no es un directorio válido."
        modificados = []
        if extensiones is None:
            extensiones = [".py", ".md", ".txt", ".json"]
        for root, dirs, files in os.walk(safe_base_path):
            if any(part in root.split(os.sep) for part in ['.git', 'venv', '__pycache__']):
                continue
            for file in files:
                if extensiones and not any(file.endswith(ext) for ext in extensiones):
                    continue
                file_path = os.path.join(root, file)
                if os.path.getsize(file_path) > FILE_SIZE_LIMIT:
                    continue
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    if texto_buscar in content:
                        new_content = content.replace(texto_buscar, texto_reemplazar)
                        fd, temp_path = tempfile.mkstemp(dir=root, text=True)
                        try:
                            with os.fdopen(fd, 'w', encoding='utf-8') as temp_file:
                                temp_file.write(new_content)
                                temp_file.flush()
                                os.fsync(temp_file.fileno())
                            os.replace(temp_path, file_path)
                            modificados.append(file_path)
                        except Exception:
                            if os.path.exists(temp_path):
                                os.remove(temp_path)
                            raise
                except Exception as e:
                    logger.error(f"Error procesando {file_path}: {e}")
        return f"Reemplazo global completado en {len(modificados)} archivos: {json.dumps(modificados)}"
    except Exception as e:
        logger.error(f"Error en buscar_reemplazar_global: {e}")
        return f"Error: {e}"
