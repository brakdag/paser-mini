# Tool Installation Guide

This document provides the step-by-step procedure for adding new tools to the Paser Mini ecosystem. To ensure the agent can discover, call, and validate tools correctly, all four steps must be completed.

## 🛠 Installation Workflow

### 1. Implementation
Create the tool logic in a JavaScript file within the `src_js/tools/` directory.
- **File Location**: `src_js/tools/<tool_name>Tools.js`
- **Error Handling**: Throw standard Error objects or custom error messages. The `ExecutionEngine` will capture these and return them as `<TOOL_RESPONSE>ERR: ...</TOOL_RESPONSE>` to the agent.
- **Example**:
  ```javascript
  export async function myTool({ param }) {
      if (!param) {
          throw new Error("Parameter cannot be empty");
      }
      return "Success";
  }
  ```

### 2. Registry Mapping
Register the function so the system can execute it when called.
- **File**: `src_js/tools/registry.js`
- **Action A**: Import the new tool function at the top of the file.
- **Action B**: Add the function to the `AVAILABLE_TOOLS` object mapping the tool name (used by the LLM) to the JavaScript function.
- **Example**:
  ```javascript
  import { myTool } from './myToolTools.js';
  
  export const AVAILABLE_TOOLS = {
      // ... other tools
      "my_tool": myTool,
  };
  ```

### 3. LLM Catalog Update
Update the catalog that is injected into the system prompt so the LLM knows the tool exists and how to use it.
- **File**: `src_js/tools/registry_positional.json`
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
- **File Location**: `src_js/core/commandHandlers/schemas/<tool_name>Schema.js`
- **Standard**: JSON Schema Draft 07.
- **Requirements**: Define the `type` as `object`, list the `properties`, and specify which fields are `required`.
- **Example**:
  ```javascript
  export const myToolSchema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "param": { "type": "string" }
    },
    "required": ["param"],
    "additionalProperties": false
  };
  ```

---
## ⚠️ Checklist for Deployment
- [ ] Implementation file created in `src_js/tools/`?
- [ ] Imported and added to `AVAILABLE_TOOLS` in `registry.js`?
- [ ] Definition added to `registry_positional.json`?
- [ ] JSON Schema created in `src_js/core/commandHandlers/schemas/`?
- [ ] Tested with a real call to verify the full loop (Prompt $\rightarrow$ Parser $\rightarrow$ Registry $\rightarrow$ Execution)?