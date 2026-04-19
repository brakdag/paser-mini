import subprocess
import os
from . import ToolError
from paser.core.config_manager import ConfigManager

# Tiempo máximo de ejecución de la instancia secundaria para evitar bucles infinitos (inception)
INSTANCE_TIMEOUT = 120

def run_instance(target: str = "paser-mini", message: str = None, args: list = None, sandbox: bool = None) -> str:
    """
    Ejecuta un módulo o script de Python.
    
    Modos:
    1. sandbox=False (por defecto): Usa el intérprete del entorno virtual (venv).
       Es rápido y compatible con todas las librerías instaladas.
    2. sandbox=True: Usa Wasmer para un aislamiento total.
       Solo permite ejecución de Python puro (sin extensiones en C).
    
    POLÍTICA DE SEGURIDAD:
    - Si el target es "paser-mini", se usa SIEMPRE el modo venv (sandbox=False).
    - Para otros targets, se utiliza el estado global de la aplicación (controlado por el comando /sandbox).
    
    Lógica de ejecución:
    - Si target es "paser-mini", ejecuta el módulo `paser.main` con el flag `--instance-mode`.
    - Si target termina en ".py", lo ejecuta como un archivo.
    - Para cualquier otro target, lo trata como un módulo (`-m`).
    """
    try:
        config = ConfigManager()
        
        # --- DETERMINACIÓN DEL MODO DE SEGURIDAD ---
        # 1. Si el target es paser-mini, siempre usamos venv para asegurar compatibilidad.
        # 2. Si el usuario pasó explícitamente un valor en la llamada (sandbox=True/False), lo respetamos.
        # 3. Si no, usamos el estado global configurado por el comando /sandbox.
        
        if target == "paser-mini":
            effective_sandbox = False
        elif sandbox is not None:
            effective_sandbox = sandbox
        else:
            effective_sandbox = config.get("sandbox_mode", False)

        cmd = []
        
        if effective_sandbox:
            # --- MODO WASMER (SANDBOX) ---
            try:
                subprocess.run(["wasmer", "--version"], capture_output=True, check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                raise ToolError("Wasmer no está instalado o no se encuentra en el PATH. No se puede activar el modo sandbox.")
            
            cmd.extend(["wasmer", "run", "--volume", ".:.", "python"])
            
            if target.endswith(".py"):
                cmd.append(target)
            else:
                cmd.extend(["-m", target])
        
        else:
            # --- MODO VENV (NORMAL) ---
            project_root = os.getcwd()
            venv_python = os.path.abspath(os.path.join(project_root, "venv", "bin", "python"))

            if not os.path.exists(venv_python):
                raise ToolError(f"Error: No se encontró el intérprete de Python en {venv_python}.")

            cmd.append(venv_python)

            if target == "paser-mini":
                cmd.extend(["-m", "paser.main", "--instance-mode"])
            elif target.endswith(".py"):
                cmd.append(target)
            else:
                cmd.extend(["-m", target])

        # Argumentos comunes (mensaje y args adicionales)
        if message:
            cmd.extend(["-m", message])
        if args and isinstance(args, list):
            cmd.extend(args)

        # Lanzamos el proceso
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            stdout, stderr = process.communicate(timeout=INSTANCE_TIMEOUT)
            status_msg = "Instancia finalizada.\n"
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            status_msg = f"[Timeout] Instancia cerrada forzosamente tras {INSTANCE_TIMEOUT}s.\n"

        output = f"{status_msg}STDOUT:\n{stdout}\nSTDERR:\n{stderr}"
        return output if output.strip() else "Instancia ejecutada sin salida visible."

    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Error al lanzar la instancia ({target}): {str(e)}")
