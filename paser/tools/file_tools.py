import os
import json
import tempfile
import logging
from .core_tools import context

logger = logging.getLogger("tools")

FILE_SIZE_LIMIT = 5 * 1024 * 1024

def read_file(path: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
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
        logger.error(f"Error en read_file {path}: {e}")
        return f"Error: {e}"

def read_files(paths: list[str]) -> str:
    if not isinstance(paths, list):
        return "Error: El parámetro 'paths' debe ser una lista de rutas."
    
    results = []
    for path in paths:
        content = read_file(path)
        results.append(f"--- ARCHIVO: {path} ---\n{content}\n--- FIN ARCHIVO ---")
        
    return "\n\n".join(results)

def write_file(path: str, contenido: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        if directorio:
            os.makedirs(directorio, exist_ok=True)
        
        # Usamos NamedTemporaryFile para un manejo más seguro de encoding y archivos temporales
        with tempfile.NamedTemporaryFile('w', dir=directorio, delete=False, encoding='utf-8') as tf:
            temp_path = tf.name
            tf.write(contenido)
            tf.flush()
            os.fsync(tf.fileno())
        
        try:
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

def remove_file(path: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        if not os.path.isfile(safe_path):
            return f"Error: Archivo no encontrado."
        os.remove(safe_path)
        logger.info(f"Archivo '{path}' borrado.")
        return f"Archivo '{path}' borrado exitosamente."
    except Exception as e:
        logger.error(f"Error al borrar archivo {path}: {e}")
        return f"Error: {e}"

def list_dir(path: str = ".") -> str:
    try:
        safe_path = context.get_safe_path(path)
        if not os.path.isdir(safe_path):
            return f"Error: '{path}' no es un directorio válido."
        return json.dumps(os.listdir(safe_path))
    except Exception as e:
        logger.error(f"Error al listar archivos en {path}: {e}")
        return f"Error: {e}"

def read_lines(path: str, inicio: int, fin: int) -> str:
    try:
        safe_path = context.get_safe_path(path)
        resultado = []
        with open(safe_path, 'r', encoding='utf-8') as f:
            for i, linea in enumerate(f, 1):
                if i >= inicio and i <= fin:
                    resultado.append(linea)
                if i > fin:
                    break
        return "".join(resultado)
    except Exception as e:
        logger.error(f"Error en read_lines {path}: {e}")
        return f"Error: {e}"

def read_head(path: str, cantidad_lineas: int) -> str:
    return read_lines(path, 1, cantidad_lineas)

def update_line(path: str, numero_linea: int, nuevo_contenido: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        linea_encontrada = False
        try:
            with tempfile.NamedTemporaryFile('w', dir=directorio, delete=False, encoding='utf-8') as tf:
                temp_path = tf.name
                with open(safe_path, 'r', encoding='utf-8') as original_file:
                    for i, line in enumerate(original_file, 1):
                        if i == numero_linea:
                            tf.write(nuevo_contenido + "\n")
                            linea_encontrada = True
                        else:
                            tf.write(line)
                tf.flush()
                os.fsync(tf.fileno())
            
            if linea_encontrada:
                os.replace(temp_path, safe_path)
                return f"Línea {numero_linea} modificada."
            else:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return "Error: Número de línea fuera de rango."
        except Exception:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
            raise
    except Exception as e:
        logger.error(f"Error en update_line {path}: {e}")
        return f"Error: {e}"

def replace_text(path: str, texto_buscar: str, texto_reemplazar: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        try:
            with tempfile.NamedTemporaryFile('w', dir=directorio, delete=False, encoding='utf-8') as tf:
                temp_path = tf.name
                with open(safe_path, 'r', encoding='utf-8') as original_file:
                    for line in original_file:
                        tf.write(line.replace(texto_buscar, texto_reemplazar))
                tf.flush()
                os.fsync(tf.fileno())
            
            os.replace(temp_path, safe_path)
            return "Reemplazo completado."
        except Exception:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
            raise
    except Exception as e:
        logger.error(f"Error en replace_text {path}: {e}")
        return f"Error: {e}"

def replace_block(path: str, texto_buscar: str, texto_reemplazar: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        directorio = os.path.dirname(safe_path)
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if texto_buscar not in content:
            return f"Error: El bloque de texto no se encontró."
        new_content = content.replace(texto_buscar, texto_reemplazar, 1)
        with tempfile.NamedTemporaryFile('w', dir=directorio, delete=False, encoding='utf-8') as tf:
            temp_path = tf.name
            tf.write(new_content)
            tf.flush()
            os.fsync(tf.fileno())
        
        try:
            os.replace(temp_path, safe_path)
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise
        return "Bloque de texto reemplazado exitosamente."
    except Exception as e:
        logger.error(f"Error en replace_block {path}: {e}")
        return f"Error: {e}"

def global_replace(path: str, texto_buscar: str, texto_reemplazar: str, extensiones: list = None) -> str:
    try:
        safe_base_path = context.get_safe_path(path)
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
                        with tempfile.NamedTemporaryFile('w', dir=root, delete=False, encoding='utf-8') as tf:
                            temp_path = tf.name
                            tf.write(new_content)
                            tf.flush()
                            os.fsync(tf.fileno())
                        
                        try:
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
        logger.error(f"Error en global_replace: {e}")
        return f"Error: {e}"

def rename_path(origen: str, destino: str) -> str:
    try:
        safe_origen = context.get_safe_path(origen)
        safe_destino = context.get_safe_path(destino)
        if not os.path.exists(safe_origen):
            return f"Error: '{origen}' no existe."
        directorio_destino = os.path.dirname(safe_destino)
        if directorio_destino:
            os.makedirs(directorio_destino, exist_ok=True)
        os.rename(safe_origen, safe_destino)
        logger.info(f"Archivo movido de '{origen}' a '{destino}'.")
        return f"Archivo movido de '{origen}' a '{destino}' exitosamente."
    except Exception as e:
        logger.error(f"Error al mover archivo de '{origen}' a '{destino}': {e}")
        return f"Error: {e}"

def make_dir(path: str) -> str:
    try:
        safe_path = context.get_safe_path(path)
        os.makedirs(safe_path, exist_ok=True)
        logger.info(f"Carpeta '{path}' creada.")
        return f"Carpeta '{path}' creada exitosamente."
    except Exception as e:
        logger.error(f"Error al crear carpeta '{path}': {e}")
        return f"Error: {e}"
