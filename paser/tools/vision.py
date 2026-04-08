import os
import io
import base64
import logging
from typing import Optional, List
from PIL import Image
from .core_tools import context

logger = logging.getLogger("tools")

def see_image(path: str, crop: Optional[List[int]] = None) -> dict:
    """
    Permite al agente ver una imagen. 
    Redimensiona la imagen a 112p para optimizar tokens y permite recortes para zoom.
    
    Args:
        path: Ruta relativa al proyecto de la imagen.
        crop: Lista [left, top, right, bottom] para recortar la imagen.
        
    Returns:
        Un diccionario con el mime_type y los datos en base64.
    """
    try:
        # 1. Validar ruta segura
        safe_path = context.get_safe_path(path)
        if not os.path.isfile(safe_path):
            raise FileNotFoundError(f"Imagen no encontrada en '{path}'.")

        # 2. Abrir imagen
        with Image.open(safe_path) as img:
            # 3. Aplicar recorte si existe (Zoom)
            if crop:
                if len(crop) != 4:
                    raise ValueError("El parámetro 'crop' debe ser una lista de 4 enteros: [left, top, right, bottom].")
                img = img.crop(crop)

            # 4. Optimización de resolución: Redimensionamos a 112p para minimizar consumo de tokens.
            width, height = img.size
            aspect_ratio = width / height
            if width < height:
                new_width = 112
                new_height = int(112 / aspect_ratio)
            else:
                new_height = 112
                new_width = int(112 * aspect_ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # 5. Conversión a RGB (elimina canal alfa de PNGs, etc.)
            if img.mode != 'RGB':
                img = img.convert('RGB')

            # 6. Compresión y Encoding a Base64
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85)
            base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')

            return {
                "mime_type": "image/jpeg",
                "data": base64_data,
                "resolution": f"{new_width}x{new_height}"
            }

    except Exception as e:
        logger.exception(f"Error procesando imagen {path}: {e}")
        raise e