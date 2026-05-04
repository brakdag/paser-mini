import json
import re
from typing import Any, Optional, Union
from src.core.validation import SchemaValidator


class AutoCorrector:
    # Pre-compiled patterns for O(1) access during execution
    KEY_FIX_PATTERN = re.compile(r"([{\s,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:")
    TRAILING_COMMA_PATTERN = re.compile(r",\s*([\}\]])")

    @staticmethod
    def fix_json(content: str) -> str:
        content = content.strip()
        
        # Fix invalid backslashes (common in LaTeX/Windows paths) before other fixes
        # Escapes backslashes that are not part of a valid JSON escape sequence
        content = re.sub(r"\\(?!(?:[\"\\\/bfnrt]|u[0-9a-fA-F]{4}))", "\\\\", content)

        # Only replace single quotes if they are acting as delimiters (start/end of string or near colons)
        # This avoids breaking contractions like "It's"
        content = re.sub(r"^'|'$|'\s*:\s*|:\s*'", '"', content)

        content = AutoCorrector.KEY_FIX_PATTERN.sub(r'\1 "\2":', content)
        content = AutoCorrector.TRAILING_COMMA_PATTERN.sub(r"\1", content)

        # Balance braces/brackets in a single pass
        # We use a simple counter to avoid multiple .count() calls
        counts = {"{": 0, "[": 0}
        mapping = {"}": "{", "]": "["}
        
        for char in content:
            if char in counts:
                counts[char] += 1
            elif char in mapping:
                counts[mapping[char]] -= 1

        # Append missing closing tags
        for open_c, count in counts.items():
            if count > 0:
                content += ( "}" if open_c == "{" else "]") * count
        
        # Prepend missing opening tags
        for open_c, count in counts.items():
            if count < 0:
                content = ( "{" if open_c == "{" else "[") * abs(count) + content
                
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
        # Fast path: try direct load
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError:
            # Slow path: attempt correction
            try:
                data = json.loads(self.corrector.fix_json(raw_content))
            except json.JSONDecodeError:
                return None, "Invalid JSON format."

        if not isinstance(data, dict) or "name" not in data:
            return None, "Missing 'name' field."

        # Sanitize tool name: remove trailing parentheses if the LLM added them
        if isinstance(data["name"], str) and data["name"].endswith("()"):
            data["name"] = data["name"][:-2]

        data.setdefault("args", {})
        validation = self.validator.validate(data["name"], data["args"])
        if not validation.is_valid:
            return None, f"Validation error: " + "; ".join(validation.errors)

        return data, None

    def extract_tool_calls(
        self, text: str
    ) -> list[tuple[Optional[dict[str, Any]], str, Optional[str]]]:
        results = []
        # finditer is the most memory-efficient way to handle multiple matches
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
