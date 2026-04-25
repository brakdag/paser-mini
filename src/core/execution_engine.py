import asyncio
import time
import logging
from typing import Union, Any
from src.core.tool_tracker import ToolAttemptTracker

logger = logging.getLogger("src")


class ExecutionEngine:
    def __init__(self, assistant, tools, tool_parser, ui, instance_mode=False):
        self.assistant = assistant
        self.tools = tools
        self.tool_parser = tool_parser
        self.ui = ui
        self.instance_mode = instance_mode
        self.tool_tracker = ToolAttemptTracker()
        self.turn_count = 0
        self.max_turns = 10000
        self.stop_requested = False

    async def execute_tool_call(self, name, args, call_data):
        if not self.tool_tracker.record_attempt(name, args):
            return self.tool_parser.format_tool_response(f"Tool loop detected: '{name}' called too many times.", call_id=call_data.get("id"), success=False), False

        if name not in self.tools:
            return self.tool_parser.format_tool_response(f"Herramienta desconocida: {name}", call_id=call_data.get("id"), success=False), False

        if name == "run_instance" and self.instance_mode:
            return self.tool_parser.format_tool_response("ERR: Recursion disabled.", call_id=call_data.get("id"), success=False), False
        
        try:
            result = await asyncio.to_thread(self.tools[name], **args)
            self.tool_tracker.record_success(name)
            return self.tool_parser.format_tool_response(result, call_id=call_data.get("id"), success=True), True
        except Exception as e:
            self.tool_tracker.record_failure(name)
            return self.tool_parser.format_tool_response(f"ERR: {str(e)}", call_id=call_data.get("id"), success=False), False
