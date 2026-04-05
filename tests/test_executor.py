"""
passer/tests/test_executor.py
Pruebas del bucle ReAct (AutonomousExecutor).
"""

import json
import os
import sys
import unittest

# Agregar la raíz del proyecto al path para importaciones
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from passer.core.executor import AutonomousExecutor
from passer.core.repetition_detector import RepetitionDetector
from passer.tools import tools_functions as tf
from passer.tools.registry import AVAILABLE_TOOLS


class DummyAssistant:
    """Mock de IAIAssistant que responde con una secuencia de respuestas predefinidas."""

    def __init__(self, responses: list[str] = None):
        # Lista de respuestas en orden. Cada llamada a send_message consume una.
        self.responses = responses or []
        self._index = 0

    @property
    def current_model(self):
        return "test-model"

    def start_chat(self, *args, **kwargs):
        pass

    def send_message(self, message: str):
        if self._index < len(self.responses):
            text = self.responses[self._index]
            self._index += 1
        else:
            text = ""
        # Return object with .text attribute like real assistant
        class Resp:
            def __init__(self, txt):
                self.text = txt
        return Resp(text)

    def get_available_models(self):
        return ["test-model"]


class TestExecutorToolCalls(unittest.TestCase):
    """Pruebas de extracción y ejecución de <TOOL_CALL>."""

    def test_single_tool_call(self):
        # Asistente: primero responde con llamada a calculadora, luego con resultado final
        assistant = DummyAssistant([
            '<TOOL_CALL>{"name": "calculadora_basica", "args": {"operacion": "2 + 2"}}</TOOL_CALL>',
            'El resultado de la operación es 4.'
        ])
        executor = AutonomousExecutor(assistant, AVAILABLE_TOOLS)
        result = executor.execute("Cuánto es 2+2?")
        self.assertIn("4", result)
        self.assertNotIn("<TOOL_CALL>", result)
        self.assertNotIn("<TOOL_RESPONSE>", result)

    def test_multiple_tool_calls(self):
        assistant = DummyAssistant([
            '<TOOL_CALL>{"name": "obtener_hora_actual", "args": {"zona_horaria": "UTC"}}</TOOL_CALL>'
            '<TOOL_CALL>{"name": "calculadora_basica", "args": {"operacion": "10 * 3"}}</TOOL_CALL>',
            'La hora en UTC es 12:00:00 y el resultado de 10*3 es 30.'
        ])
        executor = AutonomousExecutor(assistant, AVAILABLE_TOOLS)
        result = executor.execute("Hora y cálculo")
        self.assertIn("12:00:00", result)
        self.assertIn("30", result)
        self.assertNotIn("<TOOL_CALL>", result)

    def test_unknown_tool(self):
        assistant = DummyAssistant([
            '<TOOL_CALL>{"name": "herramienta_inexistente", "args": {}}</TOOL_CALL>',
            "La herramienta 'herramienta_inexistente' es desconocida y no puedo usarla."
        ])
        executor = AutonomousExecutor(assistant, AVAILABLE_TOOLS)
        result = executor.execute("Usar tool fantasma")
        self.assertIn("desconocida", result.lower())

    def test_tool_error_handling(self):
        def failing_tool():
            raise RuntimeError("Error forzado en prueba")
        test_tools = {"failing_tool": failing_tool}
        tool_response_str = json.dumps({"status": "error", "data": "Error forzado en prueba"})
        assistant = DummyAssistant([
            '<TOOL_CALL>{"name": "failing_tool", "args": {}}</TOOL_CALL>',
            f"Hmmm, ocurrió un error al procesar tu solicitud. Detalles: {tool_response_str}"
        ])
        executor = AutonomousExecutor(assistant, test_tools)
        result = executor.execute("Forzar error")
        self.assertIn("error", result.lower())


class TestRepetitionSafety(unittest.TestCase):
    """Prueba de seguridad: detección de bucle infinito via repetición."""

    def test_repetition_detection_blocks_loop(self):
        detector = RepetitionDetector(n=2, max_repeats=3)
        # Añadir secuencia repetitiva que excede max_repeats
        for _ in range(6):
            if not detector.add_text("foo bar"):
                break
        # Después de suficientes repeticiones, add_text debe retornar False
        self.assertFalse(detector.add_text("foo bar"))


class TestRepetitionDetector(unittest.TestCase):
    """Pruebas del detector de texto repetitivo."""

    def test_normal_text(self):
        detector = RepetitionDetector(n=3, max_repeats=3)
        self.assertTrue(detector.add_text("Hola, ¿cómo estás hoy?"))

    def test_repetitive_text(self):
        detector = RepetitionDetector(n=2, max_repeats=3)
        text = "foo bar " * 10
        # Tras suficiente repetición debe retornar False
        self.assertFalse(detector.add_text(text))

    def test_reset(self):
        detector = RepetitionDetector(n=2, max_repeats=3)
        detector.add_text("foo bar foo bar")
        detector.reset()
        self.assertEqual(len(detector.buffer), 0)


class TestSafePath(unittest.TestCase):
    """Pruebas de seguridad de rutas."""

    def test_path_traversal_blocked(self):
        original_root = tf.PROJECT_ROOT
        tf.set_project_root("/tmp")
        try:
            # Intentar escapar de /tmp
            tf.get_safe_path("../../etc/passwd")
            self.fail("Expected ValueError for path traversal")
        except ValueError:
            pass  # éxito
        finally:
            tf.set_project_root(original_root)

    def test_valid_path(self):
        original_root = tf.PROJECT_ROOT
        # Usar el directorio raíz del proyecto
        tf.set_project_root(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        try:
            safe = tf.get_safe_path("tests")
            self.assertTrue(safe.startswith(tf.PROJECT_ROOT))
        finally:
            tf.set_project_root(original_root)


class TestCalculatorSafety(unittest.TestCase):
    """Pruebas de seguridad de la calculadora."""

    def test_arithmetic(self):
        result = tf.calculadora_basica("2 + 3 * 4")
        self.assertIn("14", result)

    def test_nested_parentheses(self):
        result = tf.calculadora_basica("(2 + 3) * (4 - 1)")
        self.assertIn("15", result)

    def test_malicious_input(self):
        # Intentar inyección de código
        result = tf.calculadora_basica("__import__('os').system('ls')")
        self.assertIn("Error", result)


if __name__ == "__main__":
    unittest.main()
