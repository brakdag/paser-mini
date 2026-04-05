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
    # Cambiamos StreamHandler por FileHandler para evitar JSON en stdout
    handler = logging.FileHandler("paser.log")
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

# Gestión de PROJECT_ROOT
class ProjectContext:
    def __init__(self, root: str = None):
        self._root = os.path.abspath(root or os.getcwd())

    @property
    def root(self):
        return self._root

    def set_root(self, new_root: str):
        self._root = os.path.abspath(new_root)
        logger.info(f"Project root set to: {self._root}")

    def get_safe_path(self, path: str) -> str:
        """Resuelve la ruta de forma segura dentro del directorio del proyecto."""
        base = os.path.abspath(self._root)
        target = os.path.abspath(os.path.join(base, path))
        if not target.startswith(base):
            logger.warning(f"Path traversal attempt: {path}")
            raise ValueError("Acceso fuera del directorio permitido.")
        return target

# Singleton para compatibilidad (podemos evolucionar hacia inyección completa)
context = ProjectContext()
