# Tool Installation & Removal Guide

Adding or removing a tool in Paser Mini requires a surgical approach. To ensure the agent can discover, validate, and execute a tool without friction, follow this precise pipeline.

---

## 🛠 The Installation Pipeline (Adding a Tool)

### 1. Implementation (The Logic)
Tools are implemented as classes to maintain state and organization. Create the tool class in the tools directory.

- **File Location**: `src/tools/<name>Tools.js` (e.g., `myTools.js` for the `my` module)
- **Standard**: Export a class named `<Name>Tools`. Methods must be `async` and return a string or a JSON-stringified object.
- **Error Handling**: Throw standard `Error` objects. The `ExecutionEngine` will capture these and return them as `ERR: ...`.
- **Example**:
  ```javascript
  export class MyTools {
    async myMethod({ param }) {
      if (!param) throw new Error("Parameter cannot be empty");
      return JSON.stringify({ status: "success", message: "Action completed" });
    }
  }
  ```

### 2. Registry Mapping (The Bridge)
Map the class method to a name the LLM can call. This is a two-step process in `src/tools/registry.js`.

- **Step A: Module Mapping**: Add the file to the `MODULE_MAP` object.
  ```javascript
  const MODULE_MAP = {
    myTools: "./myTools.js",
    // ...
  };
  ```
- **Step B: Tool Mapping**: Add the tool to the `AVAILABLE_TOOLS` object using the `getTool` helper.
  ```javascript
  export const AVAILABLE_TOOLS = {
    "my.tool": async (args) => (await getTool("myTools", "myMethod"))(args),
    // ...
  };
  ```

### 3. LLM Catalog Update (The Discovery)
Define the tool's signature so it is injected into the System Prompt.

- **File**: `src/tools/registry_positional.json`
- **Format**: `[ "tool_name", "Clear description of utility", { "arg_name": "type" } ]`
- **Crucial**: The `tool_name` must match the key in `AVAILABLE_TOOLS` exactly.

### 4. SmartParser Schema (The Guardrail)
Define the validation schema to prevent invalid tool calls.

- **File Location**: `src/core/schemas/<tool_name>Schema.js`
- **Auto-Discovery**: The `SchemaRegistry` automatically scans this folder and loads any `.js` file that exports a schema.
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
    "my.tool": (args) => args.param || "no param",
    // ...
  };
  ```

---

## 🗑 The Removal Pipeline (Uninstalling a Tool)

To remove a tool without leaving technical debt or "ghost" schemas, follow these steps in reverse:

1. **Clean Registry**: Remove the tool from `AVAILABLE_TOOLS` and the module from `MODULE_MAP` in `src/tools/registry.js`.
2. **Clean Catalog**: Delete the tool's entry from `src/tools/registry_positional.json`.
3. **Delete Schema**: Remove the corresponding file from `src/core/schemas/`.
4. **Clean UX**: Remove the mapper from `_detailMappers` in `src/core/executionEngine.js`.
5. **Delete Logic**: Delete the tool file from `src/tools/`.

---

## ⚠️ Deployment Checklist

- [ ] **Logic**: Class created in `src/tools/` with correct naming?
- [ ] **Registry**: Module added to `MODULE_MAP` and tool to `AVAILABLE_TOOLS`?
- [ ] **Catalog**: Entry added to `registry_positional.json`?
- [ ] **Schema**: Validation file created in `src/core/schemas/`?
- [ ] **UX**: Detail mapper added to `executionEngine.js`?
- [ ] **End-to-End**: Tested a full call cycle (Prompt $\rightarrow$ Response)?

## 🔍 Troubleshooting

- **Tool not called?** Check `registry_positional.json` for typos or mismatch with `AVAILABLE_TOOLS`.
- **Validation Error?** Verify the schema in `src/core/schemas/` matches the LLM's expected output.
- **"no details" in UI?** Check if you added the mapper to `_detailMappers` in `executionEngine.js`.