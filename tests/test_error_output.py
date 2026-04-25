import asyncio
import sys
import os
from unittest.mock import MagicMock, patch

# Asegurar que el path del proyecto esté en PYTHONPATH
sys.path.append(os.getcwd())

from src.infrastructure.gemini.adapter import GeminiAdapter


class MockAPIError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.status_code = status_code

async def run_test():
    print("\n🚀 Iniciando prueba de visualización de errores...\n")
    adapter = GeminiAdapter()
    # Mock de la sesión de chat para evitar llamadas reales
    adapter.chat = MagicMock()
    
    # Caso 1: Error 429 (Cuota)
    print("--- Test 1: Error 429 (Quota) ---")
    with patch.object(adapter.retry_handler, 'execute') as mock_exec:
        mock_exec.side_effect = MockAPIError("Resource exhausted", 429)
        result = await asyncio.to_thread(adapter.send_message, "Hola")
        print(f"Output detectado: {result}")

    # Caso 2: Error 500 (Servidor)
    print("\n--- Test 2: Error 500 (Server Error) ---")
    with patch.object(adapter.retry_handler, 'execute') as mock_exec:
        mock_exec.side_effect = MockAPIError("Internal Server Error", 500)
        result = await asyncio.to_thread(adapter.send_message, "Hola")
        print(f"Output detectado: {result}")

    # Caso 3: Error de Conexión
    print("\n--- Test 3: Error de Conexión ---")
    with patch.object(adapter.retry_handler, 'execute') as mock_exec:
        mock_exec.side_effect = Exception("connection timeout")
        result = await asyncio.to_thread(adapter.send_message, "Hola")
        print(f"Output detectado: {result}")

    # Caso 4: Streaming Error 429
    print("\n--- Test 4: Streaming Error 429 ---")
    # Para probar el stream, necesitamos iterar
    # Vamos a simular el comportamiento del generador que lanza el error
    with patch.object(adapter.chat, 'send_message_stream') as mock_stream:
        def error_gen():
            # Simulamos que el error ocurre durante la iteración
            raise MockAPIError("Quota exceeded", 429)
        mock_stream.return_value = error_gen()
        
        print("Iterando stream...")
        # El método send_message_stream tiene un try/except interno que captura el error
        # y hace yield del mensaje formateado.
        for chunk in adapter.send_message_stream("Hola"):
            print(f"Chunk: {chunk}")

if __name__ == '__main__':
    asyncio.run(run_test())
