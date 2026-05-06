# 🛠️ Paser Mini: Tool Validation Suite

This document serves as a benchmark to validate the operability of the agent's tools. The goal is to execute each challenge and confirm that the tool responds as expected.

## 📋 Instructions for the Agent
1. Read each challenge sequentially.
2. Execute the necessary tools to complete the task.
3. Verify the result.
4. If a tool fails, report the exact error and the argument used.

---

## 🧪 Validation Challenges

### 1. File Operations (Basic)
- [ ] **Creation and Reading**: Create a file called `test_agent_val.txt` with the content "Tool validation successful". Then, read it to confirm the content is correct.
- [ ] **Modification**: Use `replaceString` to change "successful" to "completed" in `test_agent_user.txt`.
- [ ] **Cleanup**: Delete the file `test_agent_val.txt`.

### 2. Exploration and Search
- [ ] **Directory Mapping**: List the contents of the `src_js/core/commandHandlers/schemas` folder and count how many `.js` files there are.
- [ ] **Global Search**: Search for the string "Paser Mini" throughout the project and list the files where it appears.
- [ ] **File Patterns**: Search for all files ending in `.js` within `src_js/core`.

### 3. JSON Manipulation
- [ ] **Structure**: Create a file `test_data.json` with a nested object (e.g., `{"user": {"id": 1, "meta": {"role": "admin"}}}`).
- [ ] **Access**: Use `getJsonNode` to extract the value of `user.meta.role`.
- [ ] **Update**: Use `updateJsonNode` to change the role to "super-admin" and verify the change.

### 4. Memory and Context (Memento)
- [ ] **Storage**: Save the following information in memory (`pushMemory`): `{"key": "test_secret", "value": "Paser-12345"}`.
- [ ] **Retrieval**: Retrieve the information using `pullMemory` with the key `test_secret`.

### 5. Development Tools
- [ ] **Code Analysis**: Run `analyzeCode` on any `.js` or `.ts` file in the project and report if there are errors.
- [ ] **Instance Orchestration**: Use `newAgent` to launch a secondary instance and verify it can read the `README.md` of the project.

### 6. Complex Workflow (Stress Test)
- [ ] **The Auditor's Challenge**: 
    1. Search for all files in `src_js/` that contain the word "TODO" or "FIXME".
    2. Create a file called `audit_report.md`.
    3. Write a list of the files found and the approximate line in that file.
    4. Read the final report to confirm the audit is complete.
    5. Delete the report.

---

## 🚩 Results Matrix
| Category | Status | Notes |
| :--- | :---: | :--- |
| Files | ✅ | |
| Search | ✅ | |
| JSON | ✅ | |
| Memory | ✅ | |
| Dev Tools | ✅ | |
| Complex Flow | ✅ | |