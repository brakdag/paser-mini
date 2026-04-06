import unittest
from paser.core.executor import AutonomousExecutor
from paser.tools.registry import AVAILABLE_TOOLS

class DummyAssistant:
    def __init__(self, response):
        self.response = response
    def send_message(self, message):
        class Resp:
            def __init__(self, txt):
                self.text = txt
        return Resp(self.response)
    def get_available_models(self):
        return ["test-model"]

class TestToolConsistency(unittest.TestCase):
    def test_update_line_english_params(self):
        # Create a dummy file
        with open("test_file.txt", "w") as f:
            f.write("line 1\nline 2\nline 3")
        
        # Tool call using English parameter names
        assistant = DummyAssistant('<TOOL_CALL>{"name": "update_line", "args": {"path": "test_file.txt", "line_number": 2, "new_content": "modified line 2"}}</TOOL_CALL>')
        executor = AutonomousExecutor(assistant, AVAILABLE_TOOLS)
        
        # This should call update_line(path="test_file.txt", line_number=2, new_content="modified line 2")
        result = executor.execute("Update line 2")
        
        with open("test_file.txt", "r") as f:
            content = f.read()
        
        self.assertIn("modified line 2", content)
        self.assertIn("Line 2 modified", result)

if __name__ == "__main__":
    unittest.main()
