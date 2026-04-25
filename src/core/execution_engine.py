import asyncio
import time
import logging
import os
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
                    f"Herramienta desconocida: {name}",
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

        # Extract detail for monitoring
        detail = ""
        if name in ["read_file", "write_file", "remove_file", "replace_string"]:
            path = args.get("path", "")
            detail = os.path.basename(path) if path else ""
        elif name in ["list_dir", "create_dir"]:
            detail = args.get("path", "")
        elif name == "rename_path":
            orig = os.path.basename(args.get("origen", ""))
            dest = os.path.basename(args.get("destino", ""))
            detail = f"{orig} -> {dest}"
        elif name in ["push_memory", "pull_memory"]:
            detail = args.get("key", "unknown")
        elif name == "run_instance":
            detail = args.get("target", "unknown")
        elif name == "search_text_global":
            detail = f"'{args.get('query', '')}'"
        elif name == "search_files_pattern":
            detail = f"pattern: {args.get('pattern', '')}"

        self.ui.start_tool_monitoring(name, detail)
        await asyncio.sleep(0)

        try:
            result = await asyncio.to_thread(self.tools[name], **args)

            # Memento Notifications
            if name == "pull_memory":
                self.ui.display_message(
                    f"🧠 **Memento Pull**: Accessing node #{args.get('key')}"
                )
            elif name == "push_memory":
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
