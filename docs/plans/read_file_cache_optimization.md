# Plan: `read_file` Cache Optimization to Prevent Amnesia Loops

## 1. Objective
Prevent the agent from entering an infinite loop of `read_file` calls when it has lost the file content from its context window, but the token-saving system (`READ_CACHE`) prevents re-reading.

## 2. Current Problem Analysis
The current implementation of `read_file` in `paser/tools/file_tools.py` uses a `set` called `READ_CACHE`:
- **Call 1:** The file hash is added to the set and the content is returned.
- **Call 2:** If the hash already exists, a `ToolError("No changes since last read")` is raised.

**The Failure:** If the agent forgets the content (due to token limits or context clearing), it will attempt to read the file again. It will receive the "no changes" error, but since it still needs the information to proceed, it will call the function again, creating an infinite loop of errors.

## 3. Proposed Solution: Toggle Mechanism (Second Chance)
Modify the cache validation logic to act as a toggle instead of a permanent block.

### New Flow Logic:
1. **First Read:**
   - The hash is **not** in `READ_CACHE`.
   - Action: Add hash to `READ_CACHE` $\rightarrow$ **Return file content**.

2. **Second Read (Same file/hash):**
   - The hash **is** in `READ_CACHE`.
   - Action: **Remove the hash from `READ_CACHE`** $\rightarrow$ **Raise `ToolError("No changes since last read")`**.

3. **Third Read (Same file/hash):**
   - The hash is **not** in `READ_CACHE` (it was removed in the previous step).
   - Action: Add hash to `READ_CACHE` $\rightarrow$ **Return file content**.

## 4. Technical Impact
- **Token Consumption:** Optimization is maintained for most cases. Additional tokens are only consumed if the agent explicitly requests the file for a second consecutive time after the warning.
- **Complexity:** Minimal. It does not require changing the data structure (`set`), only the manipulation logic.
- **Stability:** Eliminates the possibility of infinite loops caused by context amnesia in this specific tool.

## 5. Verification Plan (Test Cases)
To validate the implementation, the following tests must be executed:
- **Case A (Normal Flow):** Read File X $\rightarrow$ Success $\rightarrow$ Read File Y $\rightarrow$ Success.
- **Case B (Context Saving):** Read File X $\rightarrow$ Success $\rightarrow$ Read File X $\rightarrow$ Error "No changes".
- **Case C (Amnesia Recovery):** Read File X $\rightarrow$ Success $\rightarrow$ Read File X $\rightarrow$ Error "No changes" $\rightarrow$ Read File X $\rightarrow$ Success.
- **Case D (Content Change):** Read File X $\rightarrow$ Success $\rightarrow$ Modify File X $\rightarrow$ Read File X $\rightarrow$ Success (the hash will change, bypassing the cache).

## 6. Behavioral Engineering & Cognitive Pressure

This implementation is not merely a technical fix but a strategy to optimize the agent's cognitive behavior:

- **Controlled Friction:** By introducing a deliberate obstacle (the "No changes" error), we discourage "cognitive laziness." Instead of over-relying on tools to fetch data, the agent is forced to attempt internal retrieval from its own context window first.
- **Mitigating "Lost-in-the-Middle":** Reducing redundant file reads prevents the context window from becoming bloated with duplicate information. This minimizes the risk of the "lost-in-the-middle" phenomenon, where critical information in the center of a large context is overlooked.
- **Attention Trigger:** The error serves as a signal for the agent to re-scan its history and synthesize information more deeply. This forced re-evaluation often leads to higher-quality reasoning and more accurate results.
- **The "Bypass" as a Feature:** The ability to bypass the cache by modifying a single byte (e.g., adding a space) is an acceptable backdoor. It transforms a passive request into an active, conscious decision (writing), ensuring that the agent only consumes additional tokens when it is truly determined to retrieve the information.

**Recommended Role:** Senior Python Developer / Systems Engineer