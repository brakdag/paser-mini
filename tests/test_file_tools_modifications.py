import unittest
import os
import shutil
from paser.tools import file_tools as ft
from paser.tools.core_tools import context

# Configuración del entorno de pruebas
TEST_DIR = "test_env"
TEST_FILE = "test_file.txt"

class TestFileTools(unittest.TestCase):
    def setUp(self):
        # Crear directorio temporal para pruebas
        if os.path.exists(TEST_DIR):
            shutil.rmtree(TEST_DIR)
        os.makedirs(TEST_DIR)
        context.set_root(os.path.abspath(TEST_DIR))
        
        # Crear archivo inicial
        self.test_path = os.path.join(context.root, TEST_FILE)
        with open(self.test_path, 'w', encoding='utf-8') as f:
            f.write("linea 1\nlinea 2\nlinea 3")

    def tearDown(self):
        # Limpiar entorno
        if os.path.exists(TEST_DIR):
            shutil.rmtree(TEST_DIR)

    def test_write_file(self):
        ft.write_file(TEST_FILE, "nuevo contenido")
        with open(self.test_path, 'r', encoding='utf-8') as f:
            self.assertEqual(f.read(), "nuevo contenido")

    def test_update_line(self):
        ft.update_line(TEST_FILE, 2, "linea 2 modificada")
        with open(self.test_path, 'r', encoding='utf-8') as f:
            content = f.readlines()
            self.assertEqual(content[1].strip(), "linea 2 modificada")

    def test_replace_text(self):
        ft.replace_text(TEST_FILE, "linea", "fila")
        with open(self.test_path, 'r', encoding='utf-8') as f:
            self.assertIn("fila 1", f.read())

    def test_replace_block(self):
        ft.replace_block(TEST_FILE, "linea 1\nlinea 2", "bloque reemplazado")
        with open(self.test_path, 'r', encoding='utf-8') as f:
            self.assertIn("bloque reemplazado", f.read())

if __name__ == "__main__":
    unittest.main()
