import pytest
import asyncio
from paser.core.executor import AutonomousExecutor

def test_executor_multiple_tool_calls():
    """Test multiple tool calls in one response."""
    class MockAssistant:
        def send_message(self, text):
            if "TOOL_RESPONSE" in text:
                return text
            return "<TOOL_CALL>{\"name\": \"obtener_hora_actual\", \"args\": {}}</TOOL_CALL> <TOOL_CALL>{\"name\": \"calculadora_basica\", \"args\": {\"operacion\": \"5 + 3\"}}</TOOL_CALL>"

    tools = {
        "obtener_hora_actual": lambda: "2026-04-05 14:30:00",
        "calculadora_basica": lambda operacion: "5 + 3 = 8"
    }
    executor = AutonomousExecutor(
        assistant=MockAssistant(),
        tools=tools,
        max_turns=10
    )
    input_text = "start"
    result = asyncio.run(executor.execute(input_text))
    assert "2026-04-05 14:30:00" in result
    assert "5 + 3 = 8" in result

def test_executor_max_turns():
    """Test termination when max_turns is exceeded."""
    class MockAssistant:
        def send_message(self, _):
            return "<TOOL_CALL>{\"name\": \"dummy\", \"args\": {}}</TOOL_CALL>"

    executor = AutonomousExecutor(assistant=MockAssistant(),
                                 tools={},
                                 max_turns=3)
    result = asyncio.run(executor.execute("dummy input"))
    assert "Límite de turnos excedido" in result

def test_executor_tool_error_handling():
    """Test proper error propagation from tools."""
    class MockAssistant:
        def send_message(self, text):
            if "TOOL_RESPONSE" in text:
                return text
            return "<TOOL_CALL>{\"name\": \"obtener_hora_actual\", \"args\": {}}</TOOL_CALL>"

    tools = {"obtener_hora_actual": lambda: "error"}
    executor = AutonomousExecutor(assistant=MockAssistant(),
                                 tools=tools,
                                 max_turns=10)
    
    result = asyncio.run(executor.execute("<TOOL_CALL>{\"name\": \"obtener_hora_actual\", \"args\": {}}</TOOL_CALL>"))
    assert "error" in result.lower()