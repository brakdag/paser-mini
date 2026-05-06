import asyncio
import logging
import os
from typing import Any, Dict, Callable
from src.core.tool_tracker import ToolAttemptTracker

logger = logging.getLogger("src")


class ExecutionEngine:
    def __init__(
        self, assistant, tools, tool_parser, ui, instance_mode=False, tracker=None
    ):
        self.assistant = assistant
        self.tools = tools
        self.tool_parser = tool_parser
        self.ui = ui
        self.instance_mode = instance_mode
        self.tool_tracker = tracker or ToolAttemptTracker()
        self.turn_count = 0
        self.max_turns = 10000
        self.stop_requested = False

        self._detail_mappers: Dict[str, Callable[[Dict], str]] = {
            "readFile": lambda a: os.path.basename(a.get("path", "")),
            "writeFile": lambda a: os.path.basename(a.get("path", "")),
            "removeFile": lambda a: os.path.basename(a.get("path", "")),
            "replaceString": lambda a: os.path.basename(a.get("path", "")),
            "listDir": lambda a: a.get("path", ""),
            "create_dir": lambda a: a.get("path", ""),
            "renamePath": lambda a: f"{os.path.basename(a.get('origen', ''))} -> {os.path.basename(a.get('destino', ''))}",
            "pushMemory": lambda a: a.get("key", "unknown"),
            "pullMemory": lambda a: a.get("key", "unknown"),
            "run_instance": lambda a: a.get("target", "unknown"),
            "searchTextGlobal": lambda a: f"'{a.get('query', '')}'",
            "searchFilesPattern": lambda a: f"pattern: {a.get('pattern', '')}",
            "analyzePyright": lambda a: os.path.basename(a.get("path", "")),
            "runPython": lambda a: os.path.basename(a.get("script_path", "")),
        }

    async def execute_tool_call(self, name, args, call_data):
        if not self.tool_tracker.record_attempt(name, args):
            return (
                self.tool_parser.format_tool_response(
                    f"Tool loop detected: '{name}' called too many times.",
                    call_id=call_data.get("id"),
                    success=False,
                ),
                False,
            )

        if name not in self.tools:
            return (
                self.tool_parser.format_tool_response(
                    f"Unknown tool: {name}",
                    call_id=call_data.get("id"),
                    success=False,
                ),
                False,
            )

        if name == "run_instance" and self.instance_mode:
            return (
                self.tool_parser.format_tool_response(
                    "ERR: Recursion disabled.",
                    call_id=call_data.get("id"),
                    success=False,
                ),
                False,
            )

        detail = self._detail_mappers.get(name, lambda a: "")(args)
        self.ui.start_tool_monitoring(name, detail)
        await asyncio.sleep(0)

        try:
            tool_func = self.tools[name]
            if asyncio.iscoroutinefunction(tool_func):
                result = await tool_func(**args)
            else:
                result = await asyncio.to_thread(tool_func, **args)

            if name == "pullMemory":
                self.ui.display_message(
                    f"🧠 **Memento Pull**: Accessing node #{args.get('key')}"
                )
            elif name == "pushMemory":
                self.ui.display_message(f"✍️ **Memento Push**: {result}")
            elif name == "run_instance":
                self.ui.display_message(
                    f"**🚀 Instance Test Output**\n\n```text\n{result}\n```"
                )

            self.tool_tracker.record_success(name)
            self.ui.end_tool_monitoring(name, success=True, detail=detail)
            return (
                self.tool_parser.format_tool_response(
                    result, call_id=call_data.get("id"), success=True
                ),
                True,
            )
        except Exception as e:
            self.tool_tracker.record_failure(name)
            self.ui.end_tool_monitoring(name, success=False, detail=detail)
            return (
                self.tool_parser.format_tool_response(
                    f"ERR: {str(e)}", call_id=call_data.get("id"), success=False
                ),
                False,
            )
