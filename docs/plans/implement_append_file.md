# Plan: Implement `fs.appendFile` to mitigate silent write failures

## 1. Objective
Eliminate silent data loss during the creation of large files (specifically LaTeX) by providing a mechanism to append content in small, verifiable chunks, bypassing the suspected buffer collapse in `fs.writeFile` for large arguments.

## 2. Technical Analysis
- **Problem**: `fs.writeFile` fails silently when the `content` argument is large (> 5KB) and contains high escape character density.
- **Hypothesis**: The failure occurs during the transfer of the tool argument from the host to the execution environment.
- **Solution**: Implement `fs.appendFile` using `fs.appendFile` from `fs/promises`. This allows the agent to build a file incrementally. As long as each chunk is below the failure threshold, the file will be constructed reliably.

## 3. Implementation Steps
1. **Modify `src/tools/fileTools.js`**: 
   - Add `appendFile({ path: filePath, content })` method.
   - Implement path validation using `#getSafePath`.
   - Use `await fs.appendFile(safePath, content, "utf8");`.
   - Ensure `READ_CACHE` is updated/cleared for the affected file.
2. **Create Schema**: 
   - Create `src/core/schemas/fs.appendFileSchema.js` defining the `path` and `content` arguments.
3. **Registration**: 
   - Ensure the tool is available to the `executionEngine` (usually automatic if added to the class and schema exists, depending on the registry implementation).
4. **Verification**: 
   - Create a test script that appends 10 chunks of 1KB each to a file and verifies the final size is 10KB.

## 4. Success Criteria
- Ability to create files > 10KB without silent failure.
- Verification that `fs.appendFile` returns `OK` and the file content is persisted correctly.