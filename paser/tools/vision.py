import os
import io
import base64
import logging
from typing import Optional, List
from PIL import Image
from .core_tools import context
from ..core.validation import BaseValidator, ValidationError

logger = logging.getLogger("tools")

class SeeImageArgs(BaseValidator):
    path: str
    crop: Optional[List[int]] = None

    def __init__(self, path: str, crop: Optional[List[int]] = None):
        self.path = path
        self.crop = crop
        if self.crop and len(self.crop) != 4:
            raise ValidationError("El parámetro 'crop' debe ser una lista de 4 enteros: [left, top, right, bottom].")

def see_image(path: str, crop: Optional[List[int]] = None) -> dict:
    """
    Permite al agente ver una imagen con validación de argumentos.
    """
    # 1. Validar argumentos
    args = SeeImageArgs(path=path, crop=crop)
    
    try:
        # 2. Validar ruta segura
        safe_path = context.get_safe_path(args.path)
        if not os.path.isfile(safe_path):
            raise FileNotFoundError(f"Imagen no encontrada en '{args.path}'.")

        # 3. Abrir imagen
        with Image.open(safe_path) as img:
            if args.crop:
                # Forzamos la tupla de 4 elementos para Pyright
                crop_tuple = (args.crop[0], args.crop[1], args.crop[2], args.crop[3])
                img = img.crop(crop_tuple)

            width, height = img.size
            aspect_ratio = width / height
            if width < height:
                new_width = 112
                new_height = int(112 / aspect_ratio)
            else:
                new_height = 112
                new_width = int(112 * aspect_ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            if img.mode != 'RGB':
                img = img.convert('RGB')

            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85)
            base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')

            return {
                "mime_type": "image/jpeg",
                "data": base64_data,
                "resolution": f"{new_width}x{new_height}"
            }

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise FileNotFoundError(f"Error: El archivo de imagen '{args.path}' no existe.")
    except Exception as e:
        # Captura UnidentifiedImageError y otros errores de PIL
        logger.exception(f"Error procesando imagen {args.path}: {e}")
        raise ValueError(f"Error: El archivo '{args.path}' no es una imagen válida o está corrupto.")