import os
import re
import datetime
import math
import json
import urllib.request
import urllib.parse
import html2text
import subprocess

# Esta variable será gestionada por el ChatManager
PROJECT_ROOT = os.getcwd()

def set_project_root(new_root: str):
    global PROJECT_ROOT
    PROJECT_ROOT = os.path.abspath(new_root)

def get_safe_path(path: str) -> str:
    """Resuelve la ruta de forma segura dentro del directorio del proyecto."""
    base = os.path.abspath(PROJECT_ROOT)
    target = os.path.abspath(os.path.join(base, path))
    if not target.startswith(base):
        raise ValueError("Acceso fuera del directorio permitido.")
    return target

def obtener_hora_actual(zona_horaria: str) -> str:
    try:
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        return f"La hora actual en {zona_horaria} (simulado UTC) es: {now_utc.strftime('%H:%M:%S')}"
    except Exception as e:
        return f"Error: {e}"

def obtener_directorio_actual() -> str:
    try:
        return os.getcwd()
    except Exception as e:
        return f"Error: {e}"

def calculadora_basica(operacion: str) -> str:
    try:
        result = eval(operacion) # nosec
        return f"Resultado: {result}"
    except Exception as e:
        return f"Error: {e}"

def leer_archivo(path: str) -> str:
    try:
        safe_path = get_safe_path(path)
        if not os.path.isfile(safe_path):
            return f"Error: Archivo no encontrado en '{path}'."
        with open(safe_path, 'r') as f:
            content = f.read()
            if not content:
                return f"El archivo '{path}' está vacío."
            return content
    except Exception as e:
        return f"Error: {e}"


def escribir_archivo(path: str, contenido: str) -> str:

    try:
        print(f"DEBUG: Intentando escribir en {path}")
        safe_path = get_safe_path(path)
        print(f"DEBUG: Ruta segura: {safe_path}")
        with open(safe_path, 'w') as f:
            f.write(contenido)
            f.flush()
        print(f"DEBUG: Escritura completada en {path}")
        return f"Archivo '{path}' creado/actualizado exitosamente."
    except Exception as e:
        print(f"DEBUG: Error escribiendo archivo: {e}")
        return f"Error: {e}"

def borrar_archivo(path: str) -> str:
    try:
        safe_path = get_safe_path(path)
        if not os.path.isfile(safe_path):
            return f"Error: Archivo no encontrado."
        os.remove(safe_path)
        return f"Archivo '{path}' borrado exitosamente."
    except Exception as e:
        return f"Error: {e}"

def listar_archivos(path: str = ".") -> str:
    try:
        safe_path = get_safe_path(path)
        if not os.path.isdir(safe_path):
            return f"Error: '{path}' no es un directorio válido."
        return json.dumps(os.listdir(safe_path))
    except Exception as e:
        return f"Error: {e}"

def buscar_en_internet(query: str) -> str:
    encoded_query = urllib.parse.quote(query)
    url = f"https://lite.duckduckgo.com/lite/?q={encoded_query}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
        links = re.findall(r'<a[^>]*?href=\"([^\"]+)\"[^>]*?>(.*?)</a>', html, re.DOTALL)
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
        return f"Error: {e}"



def leer_url(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
        h = html2text.HTML2Text()
        h.ignore_links = True
        h.ignore_images = True
        return h.handle(html)[:3000]
    except Exception as e:
        return f"Error al leer la URL: {e}"

def leer_lineas(path: str, inicio: int, fin: int) -> str:
    try:
        safe_path = get_safe_path(path)
        with open(safe_path, 'r') as f:
            lines = f.readlines()
            return "".join(lines[inicio-1:fin])
    except Exception as e:
        return f"Error: {e}"

def leer_cabecera(path: str, cantidad_lineas: int) -> str:
    return leer_lineas(path, 1, cantidad_lineas)

def modificar_linea(path: str, numero_linea: int, nuevo_contenido: str) -> str:
    try:
        safe_path = get_safe_path(path)
        with open(safe_path, 'r') as f:
            lines = f.readlines()
        if 1 <= numero_linea <= len(lines):
            lines[numero_linea-1] = nuevo_contenido + "\n"
            with open(safe_path, 'w') as f:
                f.writelines(lines)
            return f"Línea {numero_linea} modificada."
        return "Error: Número de línea fuera de rango."
    except Exception as e:
        return f"Error: {e}"

def reemplazar_texto(path: str, texto_buscar: str, texto_reemplazar: str) -> str:
    try:
        print(f"DEBUG: Intentando reemplazar texto en {path}")
        safe_path = get_safe_path(path)
        with open(safe_path, 'r') as f:
            content = f.read()
        new_content = content.replace(texto_buscar, texto_reemplazar)
        with open(safe_path, 'w') as f:
            f.write(new_content)
        print(f"DEBUG: Reemplazo completado en {path}")
        return "Reemplazo completado."
    except Exception as e:
        print(f"DEBUG: Error reemplazando texto en {path}: {e}")
        return f"Error: {e}"

def analizar_codigo_con_pyright(path: str = ".") -> str:
    """Analiza código usando pyright y devuelve errores si existen."""
    try:
        pyright_path = os.path.join(PROJECT_ROOT, "venv", "bin", "pyright")
        if not os.path.exists(pyright_path):
            pyright_path = "pyright"
            
        result = subprocess.run([pyright_path, "--outputjson", path], capture_output=True, text=True)
        if result.returncode == 0:
            return "No se encontraron errores de tipo."
        return result.stdout
    except Exception as e:
        return f"Error ejecutando pyright: {e}"
