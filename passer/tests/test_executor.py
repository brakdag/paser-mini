import pytest
from passer.core.executor import AutonomousExecutor

def test_executor_multiple_tool_calls():
    """Test multiple tool calls in one response."""
    tools = {
        "obtener_hora_actual": lambda: "2026-04-05 14:30:00",
        "calculadora_basica": lambda operacion: "5 + 3 = 8"
    }
    executor = AutonomousExecutor(
        assistant=mock_ai_assistant(),
        tools=tools,
        max_turns=10
    )
    input_text = (
        "<TOOL_CALL>{'name': 'obtener_hora_actual', 'args': {}}</TOOL_CALL>"
        "<TOOL_CALL>{'name': 'calculadora_basica', 'args': {'operacion': '5 + 3'}}</TOOL_CALL>"
    )
    result = executor.execute(input_text)
    assert "2026-04-05 14:30:00" in result
    assert "5 + 3 = 8" in result

def test_executor_max_turns():
    """Test termination when max_turns is exceeded."""
    executor = AutonomousExecutor(assistant=mock_ai_assistant(),
                                 tools={},
                                 max_turns=3)
    # Exhaust turns
    for _ in range(3):
        executor.execute("dummy input")
    # Fourth call should return limit message
    assert "Límite de turnos excedido" in executor.execute("dummy input")

def test_executor_tool_error_handling():
    """Test proper error propagation from tools."""
    tools = {"obtener_hora_actual": lambda: nonexistent_func()}
    executor = AutonomousExecutor(assistant=mock_ai_assistant(),
                                 tools=tools,
                                 max_turns=10)
    result = executor.execute("<TOOL_CALL>{'name': 'obtener_hora_actual', 'args': {}}</TOOL_CALL>")
    assert "Error" in result

def mock_ai_assistant():
    class Dummy:
        def send_message(self, _: str):
            return "<TOOL_CALL>{'name': 'obtener_hora_actual', 'args': {}}</TOOL_CALL>"
    return Dummy()