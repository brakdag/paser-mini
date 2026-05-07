# Tool Installation Guide: The Complete Workflow

Adding a new tool to Paser Mini is a multi-step process. Because the agent relies on a strict pipeline (Prompt $\rightarrow$ Parser $\rightarrow$ Registry $\rightarrow$ Execution $\rightarrow$ Log), missing any of these steps will result in the tool being invisible or malfunctioning.

## 🛠 The 5-Step Installation Pipeline

### 1. Implementation (The Logic)
Create the tool logic in a JavaScript file within `src_js/tools/`.
- **File Location**: `src_js/tools/<tool_name>Tools.js`
- **Standard**: Use `async` functions. Return a string or a JSON-stringified object.
- **Error Handling**: Throw standard `Error` objects. The `ExecutionEngine` captures these and wraps them in `<TOOL_RESPONSE>ERR: ...</TOOL_RESPONSE>` for the AI.
- **Example**:
  ```javascript
  export async function myTool({ param }) {
      if (!param) throw new Error("Parameter cannot be empty");
      return JSON.stringify({ status: "success", message: "Action completed" });
  }
  ```

### 2. Registry Mapping (The Bridge)
Map the JavaScript function to a name the LLM can call.
- **File**: `src_js/tools/registry.js`
- **Action A**: Import the function: `import { myTool } from './myToolTools.js';`
- **Action B**: Add to `AVAILABLE_TOOLS`: `"my_tool": myTool,`

### 3. LLM Catalog Update (The Discovery)
Define the tool's signature so it's injected into the System Prompt.
- **File**: `src_js/tools/registry_positional.json`
- **Format**: `[ "tool_name", "Clear description of utility", { "arg_name": "type" } ]`
- **Crucial**: The `tool_name` here must match the key in `registry.js` exactly.

### 4. SmartParser Schema (The Guardrail)
Prevent the agent from calling tools with invalid arguments.
- **File Location**: `src_js/core/schemas/<tool_name>Schema.js`
- **Standard**: JSON Schema Draft 07.
- **Requirement**: Define `type: "object"`, `properties`, and `required` fields.
- **Example**:
  ```javascript
  export const myToolSchema = {
    "type": "object",
    "properties": { "param": { "type": "string" } },
    "required": ["param"],
    "additionalProperties": false
  };
  ```

### 5. Response Capture & Logging (The UX)
Ensure the tool's output is translated from raw JSON to a human-readable format in the chat log.
- **Location**: `src_js/core/turnProcessor.js`
- **Logic**: The `TurnProcessor` intercepts the `result` from the `ExecutionEngine` and uses `ui.displaySystemMessage` to log a clean summary before sending the raw `<TOOL_RESPONSE>` to the AI.
- **Verification**: Check `session.log` to ensure you see `*** Tool <name> returned: <message>` instead of raw JSON.

---

## ⚠️ Deployment Checklist
- [ ] **Logic**: File created in `src_js/tools/`?
- [ ] **Registry**: Imported and mapped in `registry.js`?
- [ ] **Catalog**: Entry added to `registry_positional.json`?
- [ ] **Schema**: Validation file created in `src_js/core/schemas/`?
- [ ] **UX**: Response is appearing cleanly in the chat log?
- [ ] **End-to-End**: Tested a full call cycle (Prompt $\rightarrow$ Response)?

## 🔍 Troubleshooting
- **Tool not called?** Check `registry_positional.json` for typos in the name.
- **Validation Error?** Check the schema in `src_js/core/schemas/` against the LLM's output.
- **Raw JSON in log?** Verify the `TurnProcessor` is correctly calling `displaySystemMessage`.