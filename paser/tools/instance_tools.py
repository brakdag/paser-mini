import subprocess
import os
from . import ToolError

# Tiempo máximo de ejecución de la instancia secundaria para evitar bucles infinitos (inception)
INSTANCE_TIMEOUT = 120

def run_instance(message: str = None, args: list = None) -> str:
    """
    Lanza una nueva instancia de paser-mini en la terminal actual.
    Si se proporcionan `args`, se pasan como argumentos de línea de comandos.
    Si se proporciona un `message`, se envía a la instancia antes de cerrarla.
    La instancia se cerrará automáticamente después de INSTANCE_TIMEOUT segundos.
    """
    try:
        # Ruta al binario en el venv
        binary_path = os.path.join("venv", "bin", "paser_mini")
        
        if not os.path.exists(binary_path):
            raise ToolError(f"Binario no encontrado en {binary_path}")

        # Construimos el comando con los argumentos si existen
        cmd = [binary_path, "--instance-mode"]
        if message:
            cmd.extend(["-m", message])
        if args and isinstance(args, list):
            cmd.extend(args)

        # Lanzamos el proceso capturando salida
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            stdout, stderr = process.communicate(timeout=INSTANCE_TIMEOUT)
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            status_msg = f"[Timeout] Instancia cerrada forzosamente tras {INSTANCE_TIMEOUT}s.\n"
        else:
            status_msg = "Instancia finalizada.\n"

        output = f"{status_msg}STDOUT:\n{stdout}\nSTDERR:\n{stderr}"
        return output if output.strip() else "Instancia ejecutada sin salida visible."
    except subprocess.TimeoutExpired:
        return f"Instancia cerrada automáticamente tras {INSTANCE_TIMEOUT} segundos (Timeout para evitar bucles)."
    except subprocess.CalledProcessError as e:
        raise ToolError(f"La instancia terminó con un error: {e}")
    except Exception as e:
        raise ToolError(f"Error al lanzar la instancia: {str(e)}")
