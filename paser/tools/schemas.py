from pydantic import BaseModel, Field
from typing import List, Optional

class ReadFileSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo a leer")

class WriteFileSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo a escribir")
    contenido: str = Field(..., description="Contenido a escribir en el archivo")

class ReadFilesSchema(BaseModel):
    paths: List[str] = Field(..., description="Lista de rutas de archivos a leer")

class ReplaceStringSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo")
    search_text: str = Field(..., description="Texto a buscar")
    replace_text: str = Field(..., description="Texto de reemplazo")

class ReplaceStringAtLineSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo")
    line_number: int = Field(..., description="Línea donde debe encontrarse el texto (1-indexed)")
    search_text: str = Field(..., description="Texto exacto a buscar en esa línea")
    replace_text: str = Field(..., description="Texto de reemplazo")

class RemoveFileSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo a borrar")

class CreateDirSchema(BaseModel):
    path: str = Field(..., description="Ruta del directorio a crear")

class ReadFileWithLinesSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo a leer con números de línea")

class CopyLinesSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo origen")
    start_line: int = Field(..., description="Línea de inicio (1-indexed)")
    end_line: int = Field(..., description="Línea de fin (inclusive)")

class CutLinesSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo origen")
    start_line: int = Field(..., description="Línea de inicio (1-indexed)")
    end_line: int = Field(..., description="Línea de fin (inclusive)")

class PasteLinesSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo destino")
    line_number: int = Field(..., description="Línea donde insertar el contenido (1-indexed)")

class ValidateJsonSchema(BaseModel):
    json_string: str = Field(..., description="Cadena JSON a validar")

class ValidateJsonFileSchema(BaseModel):
    path: str = Field(..., description="Ruta del archivo JSON a validar")
