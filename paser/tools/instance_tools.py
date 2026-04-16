import subprocess
import os
from . import ToolError

# Tiempo máximo de ejecución de la instancia secundaria para evitar bucles infinitos (inception)
INSTANCE_TIMEOUT = 20

def run_instance() -> str:
    """
    Lanza una nueva instancia de paser-mini en la terminal actual.
    La instancia se cerrará automáticamente después de INSTANCE_TIMEOUT segundos para evitar bucles infinitos.
    """
    try:
        # Ruta al binario en el venv
        binary_path = os.path.join("venv", "bin", "paser_mini")
        
        if not os.path.exists(binary_path):
            raise ToolError(f"Binario no encontrado en {binary_path}")

        # Lanzamos el proceso capturando salida y enviando /q para cerrar la instancia rápidamente
        process = subprocess.Popen(
            [binary_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            stdout, stderr = process.communicate(input="/q\n", timeout=INSTANCE_TIMEOUT)
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
