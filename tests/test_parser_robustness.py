import pytest
import json
from paser.core.executor import AutonomousExecutor

class MockAssistant:
    def send_message(self, message: str) -> str:
        return message

@pytest.fixture
def executor():
    return AutonomousExecutor(assistant=MockAssistant(), tools={})

def test_json_double_quotes(executor):
    text = '<TOOL_CALL>{"name": "test", "args": {"key": "value"}}</TOOL_CALL>'
    calls = executor._extract_tool_calls(text)
    assert len(calls) == 1
    assert calls[0]["name"] == "test"
    assert calls[0]["args"] == {"key": "value"}

def test_single_quotes_fallback(executor):
    # This simulates common LLM output with single quotes
    text = "<TOOL_CALL>{'name': 'test', 'args': {'key': 'value'}}</TOOL_CALL>"
    calls = executor._extract_tool_calls(text)
    assert len(calls) == 1
    assert calls[0]["name"] == "test"
    assert calls[0]["args"] == {"key": "value"}

def test_case_insensitive_tags(executor):
    text = '<tool_call>{"name": "test", "args": {}}</tool_call>'
    calls = executor._extract_tool_calls(text)
    assert len(calls) == 1
    assert calls[0]["name"] == "test"

def test_invalid_structure(executor):
    # Missing 'args'
    text = '<TOOL_CALL>{"name": "test"}</TOOL_CALL>'
    calls = executor._extract_tool_calls(text)
    assert len(calls) == 0

def test_multiple_calls(executor):
    text = """
    <TOOL_CALL>{"name": "test1", "args": {}}</TOOL_CALL>
    Some text in between
    <TOOL_CALL>{'name': 'test2', 'args': {}}</TOOL_CALL>
    """
    calls = executor._extract_tool_calls(text)
    assert len(calls) == 2
    assert calls[0]["name"] == "test1"
    assert calls[1]["name"] == "test2"
