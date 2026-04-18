# Work Order: Implementation of the Memento Memory System

## 1. Project Overview
**Objective**: Implement a persistent, graph-based long-term memory (LTM) system to overcome LLM context window volatility using a "Context Jump" mechanism and a Golden Ratio ($\phi$) data structure.

**Core Philosophy**: Transition from "Session Logging" (Tape Recorder) to "Knowledge Asset Extraction" (Notebook).

## 2. Source of Truth (Reference Docs)
Before starting, the implementer MUST review the following documents in `docs/plans/`:
- `memento_index.md`: System map.
- `memento_methodology_ai.md`: Intentionality and Philosophy.
- `memento_implementation_plan.md`: Technical schema and $\phi$-scale.
- `memento_operational_guide.md`: Trigger workflows.
- `context_management.md`: Hard Reset and SDK synchronization.

---

## 3. Implementation Roadmap

### Phase 1: Persistence Layer (The Cognitive Graph)
- [ ] **SQLite Setup**: Create `agent_memory.db` with `nodes` and `edges` tables as specified in the Implementation Plan.
- [ ] **ID Chain**: Ensure `id` is an auto-incrementing primary key to maintain the chronological narrative thread.
- [ ] **$\phi$-Scale Validation**: Implement logic to validate that stored blocks adhere to the L0-L3 size constraints (280B $\rightarrow$ 25KB).

### Phase 2: Infrastructure & SDK Synchronization
- [ ] **Token Counting**: Integrate `count_tokens` from the Gemini API into the `ChatManager` to drive the trigger system.
- [ ] **The SDK Fix**: Implement `GeminiAdapter.refresh_session()`. This method must destroy the current `self.chat` object and recreate it using the current `self.history` to eliminate server-side ghost states.

### Phase 3: Memory Interface (The Tools)
- [ ] **`push_memory(scope, value, key, pointers)`**: 
  - Implement automatic timestamping.
  - Implement citation parsing `[#ID, Date]` and weight incrementing for cited nodes.
- [ ] **`pull_memory(scope, key, direction)`**: 
  - Implement "The Mirror" (default call) to load Protocol + Vital Tattoos + Root Summary.
  - Implement Narrative navigation (`direction="prev"/"next"`) via the ID Chain.
  - Implement Analytical navigation (`direction="up"/"down"`) via the `edges` table.

### Phase 4: The Context Jump Loop
- [ ] **Distillation Trigger (80%)**: Implement the logic that prompts the agent to begin extracting Knowledge Assets.
- [ ] **Bridge Trigger (95%)**: Implement the logic for the generation and storage of the "Bridge Block".
- [ ] **The Leap (100%)**: Implement the Hard Reset sequence:
    1. Clear `self.history` $\rightarrow$ `[]`.
    2. Call `refresh_session()`.
    3. Inject `System Prompt` + `Bridge Block` as the new session start.

---

## 4. Technical Invariants (Non-Negotiable)
- **Determinism**: The transition between sessions must be seamless. No data from the purged session may persist.
- **Immutability**: The Sequential ID Chain must never be altered or re-indexed.
- **Efficiency**: `pull_memory` calls must be optimized via SQLite indices to keep latency below 200ms.

## 5. Verification & Acceptance Criteria
- [ ] **Test Case 1 (The Leap)**: Fill context to 100% $\rightarrow$ Trigger Jump $\rightarrow$ Verify that the agent remembers the Bridge Block but has forgotten the conversational noise.
- [ ] **Test Case 2 (The Chain)**: Create 5 sequential memories $\rightarrow$ Use `direction="prev"` to navigate back to the first one without losing the thread.
- [ ] **Test Case 3 (The $\phi$-Scale)**: Attempt to push a block exceeding L3 limits $\rightarrow$ Verify that the system flags a size warning or forces a split.

## 6. Approval
**Architect Approval**: [Systems Architect Signature]
**Implementation Start Date**: [Date]
**Target Completion Date**: [Date]