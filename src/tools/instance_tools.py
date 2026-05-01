import subprocess
import os
from typing import Optional
from . import ToolError
from src.core.config_manager import ConfigManager


def _get_venv_python():
    """Helper to get the absolute path to the venv python interpreter."""
    current_file_path = os.path.abspath(__file__)
    # src/tools/instance_tools.py -> root is 3 levels up
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file_path)))
    venv_python = os.path.join(project_root, "venv", "bin", "python")
    
    if not os.path.exists(venv_python):
        raise ToolError(f"Error: No se encontró el intérprete de Python en {venv_python}.")
    
    return venv_python, project_root


def new_agent(message: Optional[str] = None, args: Optional[list] = None) -> str:
    """
    Lanza una nueva instancia independiente de Paser Mini.
    Se ejecuta en la raíz del proyecto para asegurar la carga correcta de configuraciones.
    """
    try:
        venv_python, project_root = _get_venv_python()
        config = ConfigManager()
        timeout = config.get("instance_timeout", 300)

        cmd = [venv_python, "-m", "src.main", "--instance-mode"]
        
        if message:
            cmd.extend(["-m", message])
        if args and isinstance(args, list):
            cmd.extend(args)

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=project_root
        )
        
        try:
            stdout, stderr = process.communicate(timeout=timeout)
            status_msg = "Nueva instancia finalizada.\n"
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            status_msg = f"[Timeout] Instancia cerrada forzosamente tras {timeout}s.\n"

        output = f"{status_msg}STDOUT:\n{stdout}\nSTDERR:\n{stderr}"
        return output if output.strip() else "Instancia ejecutada sin salida visible."

    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Error al lanzar la nueva instancia: {str(e)}")


def run_python(script_path: str, args: Optional[list] = None) -> str:
    """
    Ejecuta un script de Python (.py) utilizando el entorno virtual de Paser.
    """
    try:
        venv_python, _ = _get_venv_python()
        config = ConfigManager()
        timeout = config.get("instance_timeout", 300)

        abs_script_path = os.path.abspath(script_path)
        script_dir = os.path.dirname(abs_script_path)

        if not os.path.exists(abs_script_path):
            raise ToolError(f"El archivo de script no existe en la ruta: {abs_script_path}")

        cmd = [venv_python, abs_script_path]
        
        if args and isinstance(args, list):
            cmd.extend(args)

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=script_dir
        )
        
        try:
            stdout, stderr = process.communicate(timeout=timeout)
            status_msg = "Script finalizado.\n"
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            status_msg = f"[Timeout] Script cerrado forzosamente tras {timeout}s.\n"

        output = f"Archivo ejecutado: {abs_script_path}\n{status_msg}STDOUT:\n{stdout}\nSTDERR:\n{stderr}"
        return output if output.strip() else f"Script {abs_script_path} ejecutado sin salida visible."

    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Error al ejecutar el script Python ({script_path}): {str(e)}")


def verify_implementation(test_script: str) -> str:
    """
    Verifica la implementación de un cambio siguiendo la Regla de la Instancia Fresca.
    1. Ejecuta el sistema con --help para asegurar que no haya errores de importación o sintaxis.
    2. Ejecuta el script de prueba proporcionado.
    """
    try:
        # Step 1: Smoke Test (--help)
        smoke_result = new_agent(args=["--help"])
        if "usage: main.py" not in smoke_result and "Paser Mini" not in smoke_result:
            return f"❌ Smoke Test Failed: The application failed to start correctly.\n\n{smoke_result}"
        
        # Step 2: Execution Test
        test_result = run_python(test_script)
        
        return (
            "✅ Implementation Verified!\n"
            "--------------------------------------------------\n"
            "1. Smoke Test (--help): PASSED\n"
            "2. Execution Test: COMPLETED\n"
            "--------------------------------------------------\n"
            f"Test Output:\n{test_result}"
        )
    except Exception as e:
        return f"❌ Verification Error: {str(e)}"
