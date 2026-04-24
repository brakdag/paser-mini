import json
import re
import ast
from typing import Any, Optional, Union
from src.core.validation import SchemaValidator, ValidationResult

class AutoCorrector:
    @staticmethod
    def fix_json(raw_content: str) -> str:
        """
        Attempts to fix common JSON formatting errors.
        """
        content = raw_content.strip()
        
        # 1. Replace single quotes with double quotes (basic approach)
        if "'" in content and '"' not in content:
            content = content.replace("'", '"')
        
        # 2. Fix missing quotes around keys
        content = re.sub(r'([{\s,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1 "\2":', content)
        
        # 3. Remove trailing commas
        content = re.sub(r',\s*([\}\]])', r'\1', content)
        
        # 4. Try to balance braces/brackets
        open_braces = content.count('{')
        close_braces = content.count('}')
        if open_braces > close_braces:
            content += '}' * (open_braces - close_braces)
        elif close_braces > open_braces:
            content = '{' * (close_braces - open_braces) + content
            
        open_brackets = content.count('[')
        close_brackets = content.count(']')
        if open_brackets > close_brackets:
            content += ']' * (open_brackets - close_brackets)
        elif close_brackets > open_brackets:
            content = '[' * (close_brackets - open_brackets) + content
            
        return content

class SmartToolParser:
    def __init__(self):
        self.validator = SchemaValidator()
        self.corrector = AutoCorrector()

    def parse_call(self, raw_content: str) -> tuple[Optional[dict[str, Any]], Optional[str]]:
        """
        Parses a tool call with auto-correction and validation.
        Returns (parsed_data, error_message).
        """
        content = raw_content.strip()
        
        # Attempt 1: Standard JSON
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # Attempt 2: ast.literal_eval (handles single quotes better)
            try:
                data = ast.literal_eval(content)
            except (ValueError, SyntaxError, TypeError):
                # Attempt 3: Auto-correction
                try:
                    fixed = self.corrector.fix_json(content)
                    data = json.loads(fixed)
                except json.JSONDecodeError:
                    return None, "Invalid JSON format and auto-correction failed."

        if not isinstance(data, dict) or "name" not in data:
            return None, "Parsed JSON is not a valid tool call (missing 'name' field)."

        if "args" not in data:
            data["args"] = {}

        # Schema Validation
        tool_name = data["name"]
        args = data["args"]
        
        validation = self.validator.validate(tool_name, args)
        if not validation.is_valid:
            return None, f"Validation error for tool '{tool_name}': " + "; ".join(validation.errors)

        return data, None

    def extract_tool_calls(self, text: str) -> list[tuple[Optional[dict[str, Any]], str, Optional[str]]]:
        # Optimized single-pass extraction
        pattern = re.compile(r'<(?:TOOL_CALL|tool_call)\s*>(.*?)</(?:TOOL_CALL|tool_call)>', re.IGNORECASE | re.DOTALL)
        calls = []
        for match in pattern.finditer(text):
            raw = match.group(1).strip()
            data, err = self.parse_call(raw)
            calls.append((data, raw, err))
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
