import json
import os
from dataclasses import dataclass, field
from typing import Any, Optional, ClassVar

@dataclass
class ValidationResult:
    is_valid: bool
    errors: list[str] = field(default_factory=list)
    corrected_args: Optional[dict[str, Any]] = None

class SchemaValidator:
    _cached_schemas: ClassVar[dict[str, Any]] = {}

    def __init__(self, schemas_dir: Optional[str] = None):
        if schemas_dir is None:
            self.schemas_dir = os.path.join(os.path.dirname(__file__), 'schemas')
        else:
            self.schemas_dir = schemas_dir
        
        if not SchemaValidator._cached_schemas:
            self._load_schemas()

    def _load_schemas(self):
        if not os.path.exists(self.schemas_dir):
            return
        
        for filename in os.listdir(self.schemas_dir):
            if filename.endswith(".json"):
                tool_name = filename[:-5]
                try:
                    with open(os.path.join(self.schemas_dir, filename), "r", encoding="utf-8") as f:
                        SchemaValidator._cached_schemas[tool_name] = json.load(f)
                except Exception as e:
                    print(f"Error loading schema {filename}: {e}")

    @property
    def schemas(self):
        return SchemaValidator._cached_schemas

    def validate(self, tool_name: str, args: Any) -> ValidationResult:
        if tool_name not in self.schemas:
            return ValidationResult(False, [f"Tool '{tool_name}' not found in schema registry."])

        if not isinstance(args, dict):
            return ValidationResult(False, [f"Arguments for '{tool_name}' must be a JSON object, got {type(args).__name__}."])

        schema = self.schemas[tool_name]
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        additional_allowed = schema.get("additionalProperties", True)

        errors = []
        for req in required:
            if req not in args:
                errors.append(f"Missing required argument: '{req}'")

        for key, value in args.items():
            if key not in properties:
                if not additional_allowed:
                    errors.append(f"Unexpected argument: '{key}'")
                continue
            
            expected_type = properties[key].get("type")
            if expected_type == "string" and not isinstance(value, str):
                errors.append(f"Argument '{key}' must be a string, got {type(value).__name__}")
            elif expected_type == "array" and not isinstance(value, list):
                errors.append(f"Argument '{key}' must be a list, got {type(value).__name__}")
            elif expected_type == "array":
                items_type = properties[key].get("items", {}).get("type")
                if items_type == "string":
                    for i, item in enumerate(value):
                        if not isinstance(item, str):
                            errors.append(f"Item at index {i} of argument '{key}' must be a string, got {type(item).__name__}")

        return ValidationResult(len(errors) == 0, errors)
