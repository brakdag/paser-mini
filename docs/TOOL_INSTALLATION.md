# Tool Installation Guide

This document provides the step-by-step procedure for adding new tools to the Paser Mini ecosystem. To ensure the agent can discover, call, and validate tools correctly, all four steps must be completed.

## 🛠 Installation Workflow

### 1. Implementation
Create the tool logic in a Python file within the `src/tools/` directory.
- **File Location**: `src/tools/<tool_name>_tools.py`
- **Error Handling**: Use `ToolError` from `src.tools.core_tools` to communicate failures to the agent. This ensures the agent receives a clean error message instead of a Python traceback.
- **Example**:
  ```python
  from .core_tools import ToolError
  
  def my_tool(param: str):
      if not param:
          raise ToolError("Parameter cannot be empty")
      return "Success"
  ```

### 2. Registry Mapping
Register the function so the system can execute it when called.
- **File**: `src/tools/registry.py`
- **Action A**: Import the new tool module at the top of the file.
- **Action B**: Add the function to the `AVAILABLE_TOOLS` dictionary mapping the tool name (used by the LLM) to the Python function.
- **Example**:
  ```python
  import tools.my_tool_tools as mt
  
  AVAILABLE_TOOLS = {
      # ... other tools
      "my_tool": mt.my_tool,
  }
  ```

### 3. LLM Catalog Update
Update the catalog that is injected into the system prompt so the LLM knows the tool exists and how to use it.
- **File**: `src/tools/registry_positional.json`
- **Format**: Add a list entry containing `[ "tool_name", "Description of what it does", { "arg_name": "type" } ]`.
- **Example**:
  ```json
  [
    "my_tool",
    "Performs a specific action with a parameter",
    {
      "param": "string"
    }
  ]
  ```

### 4. SmartParser Schema
Create a validation schema to ensure the arguments passed by the LLM are correct before execution.
- **File Location**: `src/core/schemas/<tool_name>.json`
- **Standard**: JSON Schema Draft 07.
- **Requirements**: Define the `type` as `object`, list the `properties`, and specify which fields are `required`.
- **Example**:
  ```json
  {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "param": { "type": "string" }
    },
    "required": ["param"],
    "additionalProperties": false
  }
  ```

---
## ⚠️ Checklist for Deployment
- [ ] Implementation file created in `src/tools/`?
- [ ] Imported and added to `AVAILABLE_TOOLS` in `registry.py`?
- [ ] Definition added to `registry_positional.json`?
- [ ] JSON Schema created in `src/core/schemas/`?
- [ ] Tested with a real call to verify the full loop (Prompt $\rightarrow$ Parser $\rightarrow$ Registry $\rightarrow$ Execution)?