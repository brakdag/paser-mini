import sys
import os
# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from passer.tools import tools_functions as tf

def test_surgical_tools():
    # Setup test file
    test_file = "test_surgical.txt"
    with open(test_file, "w") as f:
        f.write("Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n")
    
    # Test leer_lineas
    result = tf.leer_lineas(test_file, 2, 4)
    print(f"leer_lineas(2, 4): {repr(result)}")
    assert result == "Line 2\nLine 3\nLine 4\n"
    
    # Test leer_cabecera
    result = tf.leer_cabecera(test_file, 2)
    print(f"leer_cabecera(2): {repr(result)}")
    assert result == "Line 1\nLine 2\n"
    
    # Test modificar_linea
    tf.modificar_linea(test_file, 3, "New Line 3")
    with open(test_file, "r") as f:
        content = f.read()
    print(f"File after modification: {repr(content)}")
    assert "New Line 3\n" in content
    
    # Test reemplazar_texto
    tf.reemplazar_texto(test_file, "Line 1", "Replaced Line 1")
    with open(test_file, "r") as f:
        content = f.read()
    print(f"File after replace: {repr(content)}")
    assert "Replaced Line 1" in content
    
    # Cleanup
    os.remove(test_file)
    print("All tests passed!")

if __name__ == "__main__":
    test_surgical_tools()
