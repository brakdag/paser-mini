# Plan: Tool Argument Flexibility & Robust Error Handling

## 1. Objective
Increase the robustness of tool argument handling to prevent execution failures caused by minor type mismatches (e.g., stringified numbers) and ensure that all tool-level errors are returned to the AI as data rather than triggering UI-blocking errors.

## 2. Analysis
- **Current Issue**: In `src/tools/fileTools.js`, the `readFile` method uses the `tail` argument directly in `lines.slice(-tail)`. 
  - If `tail` is a string like `"10"`, JavaScript coerces it, and it works.
  - If `tail` is a string like `"0"`, `if (tail)` evaluates to `true`, but `lines.slice(-0)` is equivalent to `lines.slice(0)`, returning the entire file instead of zero lines. This can lead to `FILE_SIZE_LIMIT` errors or incorrect data retrieval.
  - If `tail` is an invalid type (e.g., an object or a non-numeric string), it may lead to unexpected behavior.
- **Error Flow**: The `ExecutionEngine` already catches exceptions and returns them as `ERR: <message>` strings. The `TurnProcessor` then feeds these back to the LLM. This is the correct flow. The user's concern about "stopping execution" likely refers to the unexpected behavior of `tail: "0"` or potential unhandled edge cases in other tools.

## 3. Proposed Changes

### 3.1 `src/tools/fileTools.js` -> `readFile`
- Implement explicit type conversion for the `tail` parameter.
- Validate that the converted value is a finite number.
- Handle the `tail <= 0` case explicitly to return an empty string or a specific message, avoiding the `slice(0)` behavior.
- Return a clear `ERR: ...` message if the type conversion fails, ensuring the AI receives the error and can correct its call.

## 4. Verification Plan
1. **Test Case 1 (Numeric Tail)**: Call `read` with `tail: 10`. Expected: Last 10 lines.
2. **Test Case 2 (Stringified Numeric Tail)**: Call `read` with `tail: "10"`. Expected: Last 10 lines.
3. **Test Case 3 (Zero Tail)**: Call `read` with `tail: 0`. Expected: Empty string/0 lines.
4. **Test Case 4 (Stringified Zero Tail)**: Call `read` with `tail: "0"`. Expected: Empty string/0 lines.
5. **Test Case 5 (Invalid Tail)**: Call `read` with `tail: "abc"`. Expected: `ERR: tail must be a number`.
6. **Fresh Instance Rule**: Verify all cases using `newAgent` to ensure no cache interference.