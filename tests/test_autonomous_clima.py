import sys
import os
import json
from unittest.mock import MagicMock, patch

# Añadir el directorio raíz al path para importar módulos de paser
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from paser.tools.web_tools import buscar_en_internet
from paser.tools.file_tools import escribir_archivo

def test_clima_mendoza_autonomo():
    print("Iniciando prueba: buscar clima Mendoza y guardar en archivo...")
    
    # 1. Simular la búsqueda del clima
    # Nota: En un entorno real, la IA usaría las herramientas. 
    # Aquí estamos probando que las herramientas funcionan juntas.
    
    query = "clima en Mendoza"
    print(f"Buscando: {query}")
    resultado_busqueda = buscar_en_internet(query)
    
    # Verificar que la búsqueda retornó algo
    data = json.loads(resultado_busqueda)
    assert len(data) > 0, "La búsqueda no retornó resultados."
    
    # 2. Guardar el resultado en un archivo
    archivo_salida = "clima.txt"
    print(f"Guardando resultados en: {archivo_salida}")
    resultado_escritura = escribir_archivo(archivo_salida, resultado_busqueda)
    
    assert "exitosamente" in resultado_escritura, f"Error al escribir el archivo: {resultado_escritura}"
    
    # 3. Verificar que el archivo existe y tiene contenido
    assert os.path.exists(archivo_salida), "El archivo no se creó."
    with open(archivo_salida, 'r') as f:
        contenido = f.read()
    assert contenido == resultado_busqueda, "El contenido del archivo no coincide con la búsqueda."
    
    print("Prueba exitosa.")
    
    # Limpieza
    os.remove(archivo_salida)
    print("Limpieza realizada.")

if __name__ == "__main__":
    try:
        test_clima_mendoza_autonomo()
    except Exception as e:
        print(f"Prueba fallida: {e}")
        sys.exit(1)
