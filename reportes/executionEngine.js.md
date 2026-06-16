# FILE ANALYSIS: executionEngine.js
**Purpose:** The core engine responsible for executing tool calls and monitoring their status.

## Critical Flaws
- **The Mapper Nightmare:** The `_detailMappers` object is an architectural disaster. Hardcoding the UI representation of every tool's arguments into the engine is a violation of the Single Responsibility Principle. The engine should execute; the tool should describe itself.
- **String-Based Error Handling:** The use of `ERR:` prefixes to signal failure is primitive. It forces the system to rely on string parsing rather than structured exception handling.
- **High Coupling:** The engine is tightly coupled to the `ui` and `toolTracker`, making it impossible to run the execution logic in a headless or isolated environment.

## Efficiency Rating: D
The logic is functional, but the maintenance overhead is extreme.

## Absolute Zero Recommendation
1. **Self-Describing Tools:** Move the 'detail' logic into the tool definitions themselves.
2. **Structured Results:** Replace `ERR:` strings with a `Result` object containing `{ success: boolean, data: any, error: Error | null }`.
3. **Decouple UI:** Use an event emitter or a callback system for monitoring instead of passing the `ui` object directly into the engine.