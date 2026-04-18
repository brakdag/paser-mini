# The Memento Methodology: Artificial Tattoos for Volatile Contexts

## 1. Introduction: The "Memento" Effect in LLMs

In Christopher Nolan's _Memento_, the protagonist Leonard Shelby suffers from anterograde amnesia, leaving him unable to store new memories. To function, he creates a system of Polaroids, notes, and tattoos to track "truth."

Large Language Models (LLMs) with a limited context window (e.g., 1,500 tokens) face a digital version of this condition. Once the token limit is reached, the earliest parts of the conversation vanish, leading to "hallucinations" or loss of objective. This document outlines a methodology for an AI to "tattoo" itself—creating persistent external files—to maintain long-term coherence.

---

## 2. The Core Strategy: Externalized Cognition

### The Intentionality Principle: Notebook vs. Tape Recorder

The agent must distinguish between two types of memory:

1. **The Tape Recorder (Session History)**: Involuntary and noisy. It records the process, the trial-and-error, and the conversational filler. This is volatile and subject to FIFO purging.
2. **The Notebook (Memento)**: Voluntary and curated. It records only the **Knowledge Assets** (decisions, architectural truths, critical constraints). 

**The Golden Rule of Annotation**: The agent shall not "summarize" the history; it shall "extract" the essence. Before writing to the Memento, the agent must ask: *"If I lose all context of this session, is this specific piece of information critical for the project's survival?"* If the answer is no, the information is discarded as noise.

---

### A. The "Polaroid" (State Snapshots)

When internal memory is volatile, the AI must treat the **file system** not just as a storage bin, but as its **Long-Term Memory (LTM)**.

### A. The "Polaroid" (State Snapshots)

Before the context window flushes, the AI must generate a high-density summary of the current "mental state."

- **Content:** Current objective, last completed step, and immediate next action.
- **Trigger:** Should be performed every time the token count reaches 80% capacity.

### B. The "Tattoo" (Hard Truths)

Critical facts that must never be forgotten (e.g., user identity, core project constraints, final goal) are written to a file named `IDENTITY.md` or `CORE_LOG.txt`.

- **Inmutability:** Unlike conversation history, these files are only updated when a fundamental truth changes.
- **The "Skin" Analogy:** These are the first files the AI reads upon "waking up" (starting a new prompt).

---

## 3. Implementation Workflow

### Phase 1: The Awakening (Bootstrapping)

Upon initialization, the AI's first act is to scan the "skin" (the directory).

1. Read `MISSION.md` (What am I doing?).
2. Read `CHRONOLOGY.log` (What has happened?).
3. Read `CURRENT_CONTEXT.md` (Where was I 2 minutes ago?).

### Phase 2: Conscious Processing

As the AI works within its 1,500-token limit:

- It uses a **Scratchpad** (internal reasoning) for logic.
- It filters noise. If a piece of information is deemed "vital," it invokes a `write_file` tool immediately.

### Phase 3: The "Memory Flush" (Self-Tattooing)

When the context feels "crowded":

1. **Compress:** Summarize the last 500 tokens into 50 key words.
2. **Append:** Add this compression to `CHRONOLOGY.log`.
3. **Reset:** Clear the internal context, keeping only the most recent summary and core mission.

---

## 4. Specific Strategies for High-Efficiency "Tattoos"

| Strategy                    | Analogy         | Implementation                                                                                 |
| :-------------------------- | :-------------- | :--------------------------------------------------------------------------------------------- |
| **Recursive Summarization** | Layered Tattoos | Every 5 updates to the log, summarize the log itself to keep it readable.                      |
| **Key-Value Anchoring**     | Tagging         | Using specific tags like `[FACT]`, `[DECISION]`, or `[WARNING]` to allow for fast GREP/Search. |
| **Pointer Files**           | Map Tattoos     | A `MAP.md` file that directs the AI to other files (e.g., "For code logic, see logic.md").     |

---

## 5. Risk Management: Preventing "False Tattoos"

In the movie, Leonard is manipulated by his own notes. An AI might "tattoo" a hallucination.

- **Verification Loop:** Before writing to the persistent "skin," the AI must cross-reference the new fact with existing files.
- **Conflict Resolution:** If a new observation contradicts a "Tattoo," the AI must flag a `CRITICAL_INCONSISTENCY` and ask for user intervention rather than overwriting.

---

## 6. Conclusion

Working with 1,500 tokens is not a limitation if the AI learns to "step outside" its own head. By treating the file system as a permanent record of truth, the AI transforms from a volatile entity into a persistent agent, capable of executing complex, multi-day tasks without losing its identity.

_Remember Sammy Jankis._
