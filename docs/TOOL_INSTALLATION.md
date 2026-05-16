# Tool Installation & Removal Guide

Adding or removing a tool in Paser Mini requires a surgical approach. To ensure the agent can discover, validate, and execute a tool without friction, follow this precise pipeline.

---

## 🛠 The Installation Pipeline (Adding a Tool)

### 1. Implementation (The Logic)
Create the tool logic in a JavaScript file within the tools directory.

- **File Location**: `src/tools/<tool_name>Tools.js`
- **Standard**: Use `async` functions. Return a string or a JSON-stringified object.
- **Error Handling**: Throw standard `Error` objects. The `ExecutionEngine` will capture these and return them as `<TOOL_RESPONSE>ERR: ...</TOOL_RESPONSE>`.
- **Example**:
  ```javascript
  export async function myTool({ param }) {
    if (!param) throw new Error("Parameter cannot be empty");
    return JSON.stringify({ status: "success", message: "Action completed" });
  }
  ```

### 2. Registry Mapping (The Bridge)
Map the JavaScript function to a name the LLM can call.

- **File**: `src/tools/registry.js`
- **Action**: Import the function and add it to the `AVAILABLE_TOOLS` object.
  ```javascript
  import { myTool } from './myToolTools.js';
  export const AVAILABLE_TOOLS = {
    "my_tool": myTool,
    // ...
  };
  ```

### 3. LLM Catalog Update (The Discovery)
Define the tool's signature so it is injected into the System Prompt.

- **File**: `src/tools/registry_positional.json`
- **Format**: `[ "tool_name", "Clear description of utility", { "arg_name": "type" } ]`
- **Crucial**: The `tool_name` must match the key in `registry.js` exactly.

### 4. SmartParser Schema (The Guardrail)
Define the validation schema to prevent invalid tool calls.

- **File Location**: `src/core/schemas/<tool_name>Schema.js`
- **Auto-Discovery**: You do **not** need to register this manually. The `SchemaRegistry` automatically scans this folder and loads any `.js` file that exports a schema.
- **Example**:
  ```javascript
  export const myToolSchema = {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"],
    additionalProperties: false,
  };
  ```

### 5. UX Refinement (The Monitoring)
To prevent the UI from showing "no details" during execution, add a mapper to the `ExecutionEngine`.

- **File**: `src/core/executionEngine.js`
- **Action**: Add a mapping function to the `_detailMappers` object in the constructor.
  ```javascript
  this._detailMappers = {
    my_tool: (args) => args.param || "no param",
    // ...
  };
  ```

---

## 🗑 The Removal Pipeline (Uninstalling a Tool)

To remove a tool without leaving technical debt or "ghost" schemas, follow these steps in reverse:

1. **Clean Registry**: Remove the tool from `src/tools/registry.js` (`AVAILABLE_TOOLS`).
2. **Clean Catalog**: Delete the tool's entry from `src/tools/registry_positional.json`.
3. **Delete Schema**: Remove the corresponding file from `src/core/schemas/`.
4. **Clean UX**: Remove the mapper from `_detailMappers` in `src/core/executionEngine.js`.
5. **Delete Logic**: Delete the tool file from `src/tools/`.

---

## ⚠️ Deployment Checklist

- [ ] **Logic**: File created in `src/tools/`?
- [ ] **Registry**: Mapped in `registry.js`?
- [ ] **Catalog**: Entry added to `registry_positional.json`?
- [ ] **Schema**: Validation file created in `src/core/schemas/`?
- [ ] **UX**: Detail mapper added to `executionEngine.js`?
- [ ] **End-to-End**: Tested a full call cycle (Prompt $\rightarrow$ Response)?

## 🔍 Troubleshooting

- **Tool not called?** Check `registry_positional.json` for typos.
- **Validation Error?** Verify the schema in `src/core/schemas/` matches the LLM's expected output.
- **"no details" in UI?** Check if you added the mapper to `_detailMappers` in `executionEngine.js`.