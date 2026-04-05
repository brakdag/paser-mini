import os
import re
import datetime
import math
import json
import urllib.request
import urllib.parse
import html2text
import subprocess
import ast
import operator
import tempfile
import logging
import sys
import time

# Configuración de logging estructurado (JSON)
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage()
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

logger = logging.getLogger("tools")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

def retry_request(func):
    def wrapper(*args, **kwargs):
        max_retries = 3
        backoff_factor = 1
        for i in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if i == max_retries - 1:
                    raise e
                sleep_time = backoff_factor * (2 ** i)
                logger.warning(f"Error in {func.__name__}, retrying in {sleep_time} seconds. Attempt {i+1}/{max_retries}. Error: {e}")
                time.sleep(sleep_time)
    return wrapper

# Esta variable será gestionada por el ChatManager
PROJECT_ROOT = os.getcwd()

def set_project_root(new_root: str):
    global PROJECT_ROOT
    PROJECT_ROOT = os.path.abspath(new_root)
    logger.info(f"Project root set to: {PROJECT_ROOT}")

def get_safe_path(path: str) -> str:
    """Resuelve la ruta de forma segura dentro del directorio del proyecto."""
    base = os.path.abspath(PROJECT_ROOT)
    target = os.path.abspath(os.path.join(base, path))
    if not target.startswith(base):
        logger.warning(f"Path traversal attempt: {path}")
        raise ValueError("Acceso fuera del directorio permitido.")
    return target

def obtener_hora_actual(zona_horaria: str) -> str:
    try:
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        return f"La hora actual en {zona_horaria} (simulado UTC) es: {now_utc.strftime('%H:%M:%S')}"
    except Exception as e:
        logger.error(f"Error en obtener_hora_actual: {e}")
        return f"Error: {e}"

def obtener_directorio_actual() -> str:
    try:
        return os.getcwd()
    except Exception as e:
        logger.error(f"Error en obtener_directorio_actual: {e}")
        return f"Error: {e}"

def calculadora_basica(operacion: str) -> str:
    try:
        logger.debug(f"Calculando: {operacion}")
        # Definición de operadores permitidos para evitar RCE
        operators = {
            ast.Add: operator.add, 
            ast.Sub: operator.sub, 
            ast.Mult: operator.mul,
            ast.Div: operator.truediv, 
            ast.Pow: operator.pow, 
            ast.USub: operator.neg
        }

        def _eval(node):
            if isinstance(node, ast.Constant): # Python 3.8+
                return node.value
            elif isinstance(node, ast.BinOp):
                return operators[type(node.op)](_eval(node.left), _eval(node.right))
            elif isinstance(node, ast.UnaryOp):
                return operators[type(node.op)](_eval(node.operand))
            else:
                raise TypeError(f"Operación no soportada: {type(node)}")

        tree = ast.parse(operacion, mode='eval')
        result = _eval(tree.body)
        return f"Resultado: {result}"
    except Exception as e:
        logger.error(f"Error en calculadora_basica: {e}")
        return f"Error: {e}"

# Límite de 5MB para lectura de archivos
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
        
        # Escritura atómica usando un archivo temporal
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
        return f"Error: No tengo permisos para escribir en '{path}'. El archivo puede estar bloqueado por otro proceso o ser de solo lectura."
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

@retry_request
def _fetch_url(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read().decode('utf-8', errors='ignore')

def buscar_en_internet(query: str) -> str:
    encoded_query = urllib.parse.quote(query)
    url = f"https://lite.duckduckgo.com/lite/?q={encoded_query}"
    try:
        html = _fetch_url(url)
        links = re.findall(r'<a[^>]*?href="([^\"]+)\"[^>]*?>(.*?)</a>', html, re.DOTALL)
        results = []
        for link, title in links[:3]: # Limited to 3 results
            if 'uddg=' in link:
                params = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
                if 'uddg' in params:
                    clean_title = re.sub(r'<[^>]*?>', '', title).strip()
                    results.append({"title": clean_title, "link": params['uddg'][0]})
            elif link.startswith('http'):
                clean_title = re.sub(r'<[^>]*?>', '', title).strip()
                results.append({"title": clean_title, "link": link})
        return json.dumps(results)
    except Exception as e:
        logger.error(f"Error en buscar_en_internet: {e}")
        return f"Error: {e}"


def leer_url(url: str) -> str:
    try:
        html = _fetch_url(url)
        h = html2text.HTML2Text()
        h.ignore_links = True
        h.ignore_images = True
        return h.handle(html)[:3000]
    except Exception as e:
        logger.error(f"Error al leer la URL {url}: {e}")
        return f"Error al leer la URL: {e}"

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
        
        # Usamos un archivo temporal para evitar cargar todo en memoria
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
                logger.info(f"Línea {numero_linea} modificada en {path}.")
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
        
        # Usamos un archivo temporal para evitar cargar todo en memoria
        fd, temp_path = tempfile.mkstemp(dir=directorio, text=True)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as temp_file:
                with open(safe_path, 'r', encoding='utf-8') as original_file:
                    for line in original_file:
                        temp_file.write(line.replace(texto_buscar, texto_reemplazar))
            os.replace(temp_path, safe_path)
            logger.info(f"Reemplazo completado en {path}.")
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
            return f"Error: El bloque de texto no se encontró exactamente en el archivo."
        
        new_content = content.replace(texto_buscar, texto_reemplazar, 1)
        
        # Escritura atómica
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
        
        logger.info(f"Bloque de texto reemplazado en {path}.")
        return "Bloque de texto reemplazado exitosamente."
    except Exception as e:
        logger.error(f"Error en reemplazar_bloque_texto {path}: {e}")
        return f"Error: {e}"

def analizar_codigo_con_pyright(path: str = ".") -> str:
    """Analiza código usando pyright y devuelve errores si existen."""
    try:
        pyright_path = os.path.join(PROJECT_ROOT, "venv", "bin", "pyright")
        if not os.path.exists(pyright_path):
            pyright_path = "pyright"
            
        safe_path = get_safe_path(path)
        result = subprocess.run([pyright_path, "--outputjson", safe_path], capture_output=True, text=True)
        if result.returncode == 0:
            return "No se encontraron errores de tipo."
        return result.stdout
    except Exception as e:
        logger.error(f"Error ejecutando pyright: {e}")
        return f"Error ejecutando pyright: {e}"

