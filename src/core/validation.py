import json
import os
from dataclasses import dataclass, field
from typing import Any, Optional, ClassVar, Callable

@dataclass
class ValidationResult:
    is_valid: bool
    errors: list[str] = field(default_factory=list)
    corrected_args: Optional[dict[str, Any]] = None

class CompiledSchema:
    """Pre-compiled schema to eliminate runtime interpretation overhead."""
    def __init__(self, tool_name: str, schema: dict):
        self.tool_name = tool_name
        self.required = set(schema.get("required", []))
        self.additional_allowed = schema.get("additionalProperties", True)
        self.validators: dict[str, Callable[[Any], Optional[str]]] = {}
        
        properties = schema.get("properties", {})
        for key, prop in properties.items():
            self.validators[key] = self._compile_validator(key, prop)

    def _compile_validator(self, key: str, prop: dict) -> Callable[[Any], Optional[str]]:
        expected_type = prop.get("type")
        
        if expected_type == "string":
            return lambda v: None if isinstance(v, str) else f"Argument '{key}' must be a string, got {type(v).__name__}"
        
        if expected_type == "array":
            items_type = prop.get("items", {}).get("type")
            if items_type == "string":
                def validate_array(v):
                    if not isinstance(v, list):
                        return f"Argument '{key}' must be a list, got {type(v).__name__}"
                    for i, item in enumerate(v):
                        if not isinstance(item, str):
                            return f"Item at index {i} of argument '{key}' must be a string, got {type(item).__name__}"
                    return None
                return validate_array
            
            return lambda v: None if isinstance(v, list) else f"Argument '{key}' must be a list, got {type(v).__name__}"
        
        return lambda v: None

class SchemaValidator:
    _cached_schemas: ClassVar[dict[str, CompiledSchema]] = {}

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
                        raw_schema = json.load(f)
                        SchemaValidator._cached_schemas[tool_name] = CompiledSchema(tool_name, raw_schema)
                except Exception as e:
                    print(f"Error loading schema {filename}: {e}")

    @property
    def schemas(self):
        return SchemaValidator._cached_schemas

    def validate(self, tool_name: str, args: Any) -> ValidationResult:
        compiled = self.schemas.get(tool_name)
        if not compiled:
            return ValidationResult(False, [f"Tool '{tool_name}' not found in schema registry."])

        if not isinstance(args, dict):
            return ValidationResult(False, [f"Arguments for '{tool_name}' must be a JSON object, got {type(args).__name__}."])

        errors = []
        
        # O(R) check using set difference
        missing = compiled.required - args.keys()
        if missing:
            for req in missing:
                errors.append(f"Missing required argument: '{req}'")

        # O(A) check using pre-compiled validator functions
        for key, value in args.items():
            validator = compiled.validators.get(key)
            if not validator:
                if not compiled.additional_allowed:
                    errors.append(f"Unexpected argument: '{key}'")
                continue
            
            err = validator(value)
            if err:
                errors.append(err)

        return ValidationResult(not errors, errors)
