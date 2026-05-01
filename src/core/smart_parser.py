import json
import re
from typing import Any, Optional, Union
from src.core.validation import SchemaValidator


class AutoCorrector:
    # Pre-compiled patterns
    KEY_FIX_PATTERN = re.compile(r"([{\s,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:")
    TRAILING_COMMA_PATTERN = re.compile(r",\s*([\}\]])")

    @staticmethod
    def fix_json(content: str) -> str:
        content = content.strip()
        if "'" in content and '"' not in content:
            content = content.replace("'", '"')

        content = AutoCorrector.KEY_FIX_PATTERN.sub(r'\1 "\2":', content)
        content = AutoCorrector.TRAILING_COMMA_PATTERN.sub(r"\1", content)

        # Balance braces/brackets efficiently
        for open_c, close_c in [("{", "}"), ("[", "]")]:
            diff = content.count(open_c) - content.count(close_c)
            if diff > 0:
                content += close_c * diff
            elif diff < 0:
                content = open_c * abs(diff) + content
        return content


class SmartToolParser:
    TOOL_PATTERN = re.compile(
        r"<(?:TOOL_CALL|tool_call)\s*>(.*?)(?:</(?:TOOL_CALL|tool_call)>|$)",
        re.IGNORECASE | re.DOTALL,
    )

    def __init__(self):
        self.validator = SchemaValidator()
        self.corrector = AutoCorrector()

    def parse_call(
        self, raw_content: str
    ) -> tuple[Optional[dict[str, Any]], Optional[str]]:
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError:
            try:
                data = json.loads(self.corrector.fix_json(raw_content))
            except json.JSONDecodeError:
                return None, "Invalid JSON format."

        if not isinstance(data, dict) or "name" not in data:
            return None, "Missing 'name' field."

        data.setdefault("args", {})
        validation = self.validator.validate(data["name"], data["args"])
        if not validation.is_valid:
            return None, f"Validation error: " + "; ".join(validation.errors)

        return data, None

    def extract_tool_calls(
        self, text: str
    ) -> list[tuple[Optional[dict[str, Any]], str, Optional[str]]]:
        results = []
        for m in self.TOOL_PATTERN.finditer(text):
            content = m.group(1).strip()
            data, err = self.parse_call(content)
            results.append((data, content, err))
        return results

    @staticmethod
    def format_tool_response(
        data: Any, call_id: Optional[Union[int, str]] = None, success: bool = True
    ) -> str:
        return f"<TOOL_RESPONSE>{json.dumps({'id': call_id, 'status': 'success' if success else 'error', 'data': data})}</TOOL_RESPONSE>"

    @staticmethod
    def clean_response(text: str) -> str:
        return re.sub(r"<[^>]+>.*?</[^>]+>", "", text, flags=re.DOTALL) if text else ""
