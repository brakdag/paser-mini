import sys
import os
import json

# Añadir el directorio raíz al path para importar módulos de passer
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from passer.tools.tools_functions import obtener_directorio_actual

def test_get_cwd():
    print("Iniciando prueba: obtener directorio actual...")
    
    cwd = obtener_directorio_actual()
    print(f"Directorio actual obtenido: {cwd}")
    
    expected_cwd = os.getcwd()
    
    assert cwd == expected_cwd, f"El directorio obtenido '{cwd}' no coincide con el real '{expected_cwd}'"
    
    print("Prueba exitosa.")

if __name__ == "__main__":
    try:
        test_get_cwd()
    except Exception as e:
        print(f"Prueba fallida: {e}")
        sys.exit(1)
