from paser.core.executor import AutonomousExecutor
from typing import Any

class MockAssistant:
    def send_message(self, message: str) -> str:
        return message

def test_robust_parsing():
    executor = AutonomousExecutor(assistant=MockAssistant(), tools={})
    
    # Test JSON double quotes
    text1 = '<TOOL_CALL>{"name": "test", "args": {}}</TOOL_CALL>'
    assert len(executor._extract_tool_calls(text1)) == 1
    
    # Test single quotes (old style)
    text2 = "<TOOL_CALL>{'name': 'test', 'args': {}}</TOOL_CALL>"
    assert len(executor._extract_tool_calls(text2)) == 1
    
    # Test case-insensitive
    text3 = '<tool_call>{"name": "test", "args": {}}</tool_call>'
    assert len(executor._extract_tool_calls(text3)) == 1
    
    print("All tests passed!")

test_robust_parsing()
