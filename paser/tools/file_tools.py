import os
import json
import tempfile
import logging
from .core_tools import context

logger = logging.getLogger("tools")

FILE_SIZE_LIMIT = 5 * 1024 * 1024

def read_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
    if not os.path.isfile(safe_path):
        raise FileNotFoundError(f"Archivo no encontrado en '{path}'.")
    
    file_size = os.path.getsize(safe_path)
    if file_size > FILE_SIZE_LIMIT:
        raise ValueError(f"El archivo '{path}' es demasiado grande ({file_size / 1024 / 1024:.2f} MB). El límite es {FILE_SIZE_LIMIT / 1024 / 1024:.2f} MB.")
    
    with open(safe_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if not content:
            return f"El archivo '{path}' está vacío."
        return content

def read_files(paths: list[str]) -> str:
    if not isinstance(paths, list):
        raise TypeError("El parámetro 'paths' debe ser una lista de rutas.")
    
    results = []
    for path in paths:
        content = read_file(path)
        results.append(f"--- ARCHIVO: {path} ---\n{content}\n--- FIN ARCHIVO ---")
        
    return "\n\n".join(results)

def write_file(path: str, contenido: str) -> str:
    safe_path = context.get_safe_path(path)
    directorio = os.path.dirname(safe_path)
    if directorio:
        os.makedirs(directorio, exist_ok=True)
    
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

def remove_file(path: str) -> str:
    safe_path = context.get_safe_path(path)
    if not os.path.isfile(safe_path):
        raise FileNotFoundError(f"Archivo no encontrado: {path}")
    os.remove(safe_path)
    logger.info(f"Archivo '{path}' borrado.")
    return f"Archivo '{path}' borrado exitosamente."

def list_dir(path: str = ".") -> str:
    safe_path = context.get_safe_path(path)
    if not os.path.isdir(safe_path):
        raise NotADirectoryError(f"'{path}' no es un directorio válido.")
    return json.dumps(os.listdir(safe_path))

def read_lines(path: str, inicio: int, fin: int) -> str:
    safe_path = context.get_safe_path(path)
    resultado = []
    with open(safe_path, 'r', encoding='utf-8') as f:
        for i, linea in enumerate(f, 1):
            if i >= inicio and i <= fin:
                resultado.append(linea)
            if i > fin:
                break
    return "".join(resultado)

def read_head(path: str, cantidad_lineas: int) -> str:
    return read_lines(path, 1, cantidad_lineas)

def update_line(path: str, line_number: int, new_content: str) -> str:
    safe_path = context.get_safe_path(path)
    directorio = os.path.dirname(safe_path)
    linea_encontrada = False
    
    with tempfile.NamedTemporaryFile('w', dir=directorio, delete=False, encoding='utf-8') as tf:
        temp_path = tf.name
        with open(safe_path, 'r', encoding='utf-8') as original_file:
            for i, line in enumerate(original_file, 1):
                if i == line_number:
                    tf.write(new_content + "\n")
                    linea_encontrada = True
                else:
                    tf.write(line)
        tf.flush()
        os.fsync(tf.fileno())
    
    if linea_encontrada:
        os.replace(temp_path, safe_path)
        return f"Line {line_number} modified."
    else:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise IndexError(f"Line number {line_number} out of range in {path}.")

def replace_text(path: str, search_text: str, replace_text: str) -> str:
    safe_path = context.get_safe_path(path)
    directorio = os.path.dirname(safe_path)
    
    with tempfile.NamedTemporaryFile('w', dir=directorio, delete=False, encoding='utf-8') as tf:
        temp_path = tf.name
        with open(safe_path, 'r', encoding='utf-8') as original_file:
            for line in original_file:
                tf.write(line.replace(search_text, replace_text))
        tf.flush()
        os.fsync(tf.fileno())
    
    os.replace(temp_path, safe_path)
    return "Replacement completed."

def replace_block(path: str, search_text: str, replace_text: str) -> str:
    safe_path = context.get_safe_path(path)
    directorio = os.path.dirname(safe_path)
    with open(safe_path, 'r', encoding='utf-8') as f:
        content = f.read()
    if search_text not in content:
        raise ValueError(f"The text block was not found in {path}.")
    new_content = content.replace(search_text, replace_text, 1)
    with tempfile.NamedTemporaryFile('w', dir=directorio, delete=False, encoding='utf-8') as tf:
        temp_path = tf.name
        tf.write(new_content)
        tf.flush()
        os.fsync(tf.fileno())
    
    os.replace(temp_path, safe_path)
    return "Text block replaced successfully."

def global_replace(path: str, search_text: str, replace_text: str, extensions: list = None) -> str:
    safe_base_path = context.get_safe_path(path)
    if not os.path.isdir(safe_base_path):
         raise NotADirectoryError(f"'{path}' is not a valid directory.")
    modificados = []
    if extensions is None:
        extensions = [".py", ".md", ".txt", ".json"]
    for root, dirs, files in os.walk(safe_base_path):
        if any(part in root.split(os.sep) for part in ['.git', 'venv', '__pycache__']):
            continue
        for file in files:
            if extensions and not any(file.endswith(ext) for ext in extensions):
                continue
            file_path = os.path.join(root, file)
            if os.path.getsize(file_path) > FILE_SIZE_LIMIT:
                continue
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if search_text in content:
                    new_content = content.replace(search_text, replace_text)
                    with tempfile.NamedTemporaryFile('w', dir=root, delete=False, encoding='utf-8') as tf:
                        temp_path = tf.name
                        tf.write(new_content)
                        tf.flush()
                        os.fsync(tf.fileno())
                    
                    os.replace(temp_path, file_path)
                    modificados.append(file_path)
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
    return f"Global replacement completed in {len(modificados)} files: {json.dumps(modificados)}"

def rename_path(source: str, destination: str) -> str:
    safe_origen = context.get_safe_path(source)
    safe_destino = context.get_safe_path(destination)
    if not os.path.exists(safe_origen):
        raise FileNotFoundError(f"'{source}' does not exist.")
    directorio_destino = os.path.dirname(safe_destino)
    if directorio_destino:
        os.makedirs(directorio_destino, exist_ok=True)
    os.rename(safe_origen, safe_destino)
    logger.info(f"Path moved from '{source}' to '{destination}'.")
    return f"Path moved from '{source}' to '{destination}' successfully."

def make_dir(path: str) -> str:
    safe_path = context.get_safe_path(path)
    os.makedirs(safe_path, exist_ok=True)
    logger.info(f"Carpeta '{path}' creada.")
    return f"Carpeta '{path}' creada exitosamente."

from pathlib import Path

def glob_search(pattern: str) -> str:
    """Busca archivos que coincidan con un patrón glob recursivo dentro del directorio de trabajo."""
    # Obtenemos la raíz segura para asegurar que no se salga del proyecto
    root_safe = context.get_safe_path(".")
    path_obj = Path(root_safe)
    
    # Buscamos los archivos
    # Filtramos directorios comunes que no queremos indexar
    matches = []
    for p in path_obj.glob(pattern):
        # Evitar archivos en carpetas ocultas o venv
        if any(part in p.parts for part in ['.git', 'venv', '__pycache__']):
            continue
        # Guardamos la ruta relativa al root para que el modelo la use fácilmente
        matches.append(str(p.relative_to(path_obj)))
    
    return json.dumps(matches)

def global_search(query: str) -> str:
    """Busca una cadena de texto en todos los archivos del proyecto."""
    root_safe = context.get_safe_path(".")
    results = []
    
    for root, dirs, files in os.walk(root_safe):
        # Saltar carpetas irrelevantes
        if any(part in root.split(os.sep) for part in ['.git', 'venv', '__pycache__']):
            continue
            
        for file in files:
            file_path = os.path.join(root, file)
            if os.path.getsize(file_path) > FILE_SIZE_LIMIT:
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f, 1):
                        if query in line:
                            # Guardamos ruta relativa, línea y el contenido limpio
                            rel_path = os.path.relpath(file_path, root_safe)
                            results.append({
                                "file": rel_path,
                                "line": i,
                                "text": line.strip()
                            })
            except Exception as e:
                logger.error(f"Error leyendo {file_path}: {e}")
                
    return json.dumps(results)