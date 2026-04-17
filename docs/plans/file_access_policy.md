# Plan: File Access and Reading Policy

## Objective
Redefine the maximum file reading and writing limits to prevent context window overflow, avoid TPM (Tokens Per Minute) exhaustion, and mitigate "context amnesia" and system instability.

## Problem Analysis
- **Current Limit**: 1MB.
- **Risks**:
    1. **Read Risk**: A 1MB text file can contain ~200k-500k tokens. Reading it would trigger a massive FIFO purge of history and potentially exceed the 250k TPM limit.
    2. **Write Risk**: Allowing large writes creates a symmetry problem. If the agent writes a file larger than the read limit, it creates a file it can no longer read or edit, leading to operational failure.
    3. **System Risk**: Unbounded or large writes could lead to disk space issues or corrupted project states if the agent enters a writing loop.

## Proposed Specification
- **Hard Limit (Read & Write)**: **100 KB**.
- **Read Behavior**: If a file exceeds 100KB, `read_file` returns: `ERR: File too large (limit 100KB). Please use a more specific tool or request a partial read.`
- **Write Behavior**: If the content to be written exceeds 100KB, `write_file` (and `replace_string`) must return: `ERR: Content too large (limit 100KB). Please split the content into smaller files.`
- **Justification**: 
    - Maintains symmetry: The agent can always read what it writes.
    - Protects the context window and TPM consumption.
    - Ensures project stability.

## Architectural Impact
- **`paser/tools/file_tools.py`**:
    - Implement a size check before executing `read()` operations.
    - Implement a size check on the `contenido` string before executing `write()` operations.
    - Ensure both checks use the same constant (100KB) to maintain consistency.

## Verification Plan
- **Test A (Small File)**: Read/Write a 10KB file $\rightarrow$ Success.
- **Test B (Read Limit)**: Attempt to read a 1MB log file $\rightarrow$ Expected `ERR: File too large`.
- **Test C (Write Limit)**: Attempt to write a 200KB string $\rightarrow$ Expected `ERR: Content too large`.
- **Test D (Symmetry)**: Write a 90KB file $\rightarrow$ Success $\rightarrow$ Read the same file $\rightarrow$ Success.