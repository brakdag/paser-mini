import os
import json
import logging
import datetime
import sys

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

# Gestión de PROJECT_ROOT
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
