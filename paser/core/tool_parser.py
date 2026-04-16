import json
import re
import ast
from typing import Any, Optional, Union

class ToolParser:
    @staticmethod
    def parse_call_content(raw_content: str) -> Optional[dict[str, Any]]:
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError:
            try:
                data = ast.literal_eval(raw_content)
            except (ValueError, SyntaxError, TypeError):
                try:
                    s_double = raw_content.replace("'", '"')
                    data = json.loads(s_double)
                except json.JSONDecodeError:
                    return None
        if not isinstance(data, dict) or "name" not in data:
            return None
        if "args" not in data:
            data["args"] = {}
        return data

    @staticmethod
    def extract_tool_calls(text: str) -> list[tuple[Optional[dict[str, Any]], str]]:
        calls = []
        # Markdown blocks
        md_pattern = r'```(?:json)?\s*(.*?)\s*```'
        for match in re.finditer(md_pattern, text, re.DOTALL):
            content = match.group(1).strip()
            data = ToolParser.parse_call_content(content)
            if data: calls.append((data, content))
        
        # XML-like tags
        tag_pattern = r'<(?:TOOL_CALL|tool_call)\s*>(.*?)</(?:TOOL_CALL|tool_call)>'
        for match in re.finditer(tag_pattern, text, re.IGNORECASE | re.DOTALL):
            raw = match.group(1).strip()
            calls.append((ToolParser.parse_call_content(raw), raw))
        
        # Fallback to raw JSON
        if not calls:
            json_pattern = r'\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}'
            for match in re.finditer(json_pattern, text, re.DOTALL):
                raw = match.group(0).strip()
                data = ToolParser.parse_call_content(raw)
                if data and 'name' in data: calls.append((data, raw))
        return calls

    @staticmethod
    def format_tool_response(data: Any, call_id: Optional[Union[int, str]] = None, success: bool = True) -> str:
        payload = {"id": call_id, "status": "success" if success else "error", "data": data}
        return f"<TOOL_RESPONSE>{json.dumps(payload)}</TOOL_RESPONSE>"

    @staticmethod
    def clean_response(text: str) -> str:
        """Removes tool tags and responses from the final output."""
        if not text:
            return ""
        return re.sub(r'<[^>]+>.*?</[^>]+>', '', text, flags=re.DOTALL)
