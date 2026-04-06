import unittest
import os
import shutil
import json
from unittest.mock import MagicMock
from paser.infrastructure.gemini_adapter import GeminiAdapter
from paser.core.chat_manager import ChatManager

# Crear directorios de prueba
TEST_BASE = "test_env_sessions"
SESSIONS_DIR = os.path.join(TEST_BASE, "sessions")

class TestSessionPersistence(unittest.TestCase):
    def setUp(self):
        if os.path.exists(TEST_BASE):
            shutil.rmtree(TEST_BASE)
        os.makedirs(SESSIONS_DIR)

    def tearDown(self):
        if os.path.exists(TEST_BASE):
            shutil.rmtree(TEST_BASE)

    def test_gemini_history_serialization(self):
        # Mock del objeto chat y sus métodos de historial
        mock_chat = MagicMock()
        # Simular una estructura de historial de Gemini
        mock_content1 = MagicMock()
        mock_content1.role = "user"
        mock_content1.parts = [MagicMock(text="Hola")]
        mock_content2 = MagicMock()
        mock_content2.role = "model"
        mock_content2.parts = [MagicMock(text="Hola, ¿cómo estás?")]
        
        mock_chat.history = [mock_content1, mock_content2]
        
        adapter = GeminiAdapter()
        adapter.chat = mock_chat
        
        history = adapter.get_history()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["role"], "user")
        self.assertEqual(history[0]["parts"][0], "Hola")

    def test_chat_manager_session_save_load(self):
        # Mock de asistente y configuraciones
        mock_assistant = MagicMock()
        mock_assistant.current_model = "test-model"
        mock_assistant.get_history.return_value = [{"role": "user", "parts": ["Test"]}]
        
        # Necesitamos ajustar el path de sessions dinámicamente o usar el default
        # ChatManager busca en ../../sessions relativo a su archivo.
        # Esto es complejo en tests, así que mockeamos la ruta si es necesario.
        
        chat_manager = ChatManager(mock_assistant, {}, {})
        chat_manager.temperature = 0.5
        
        # Forzar guardado en nuestro directorio de prueba
        path = chat_manager.save_session("test_session")
        self.assertTrue(os.path.exists(path))
        
        with open(path, "r") as f:
            data = json.load(f)
            self.assertEqual(data["model_name"], "test-model")
            self.assertEqual(data["history"][0]["parts"][0], "Test")

if __name__ == "__main__":
    unittest.main()
