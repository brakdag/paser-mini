# Memento Operational Guide: AI Execution Manual

This guide defines the exact operational triggers and workflows an agent must follow to maintain the Memento Memory System. It transforms the technical capabilities of the Cognitive Graph into a set of behavioral mandates.

---

## 🌅 1. The Awakening (Boot Sequence)

Every new session or context reset must begin with the **Mirror Effect**. The agent is forbidden from executing project tasks before establishing its identity.

**Workflow**:
1. **Call `pullMemory()`** (no arguments).
2. **Analyze the result**: 
   - Identify the **Current Mission** from the Root Summary.
   - Internalize the **Vital Tattoos** (Core constraints).
   - Review the **Memory Protocol** (Behavioral rules).
3. **Acknowledge**: Confirm to the user: "Identity synchronized. Current objective: [Objective]."

---

## ⚙️ 2. The Conscious Loop (Active Work)

To prevent redundancy and "cognitive drift," the agent must treat memory as a prerequisite for action.

### A. Pre-Action Verification
Before starting a complex task or implementing a feature:
- **Trigger**: "I am about to implement X."
- **Action**: `pullMemory(scope="fractal", key="X" or search_query)`.
- **Goal**: Verify if a similar implementation was attempted, why it failed, or if a design decision already exists.

### B. Insight Capture
- **Trigger**: "I have discovered a non-obvious truth about the codebase/system."
- **Action**: `pushMemory(scope="fractal", value="[Insight]", pointers=[related_ids])`.
- **Goal**: Prevent the loss of "eureka moments" that would otherwise vanish during a context flush.

---

## 🧼 3. The Context Jump (Expansion $\rightarrow$ Distillation $\rightarrow$ Leap)

To avoid the degradation of the context window, the agent uses a "Context Jump" mechanism instead of gradual purging.

### Phase A: Distillation (80% $\rightarrow$ 95% Capacity)
**Trigger**: Token count reaches **80%**.
**Action**: The agent begins extracting **Knowledge Assets** and pushing them to the Memento graph. These records remain in the current context to maintain immediate coherence.

### Phase B: The Bridge (95% $\rightarrow$ 100% Capacity)
**Trigger**: Context is nearly full.
**Action**: The agent generates a **Bridge Block**. This is a high-density summary that links the completed work, cites the most important newly created nodes, and explicitly defines the *immediate next step*.
**Push**: `pushMemory(scope="fractal", value="[Bridge Block Content]", teaser="BRIDGE: [Session Summary]")`.

### Phase C: The Leap (Hard Reset)
**Trigger**: Completion of the Bridge Block.
**Action**: 
1. **Wipe**: Clear the entire conversation history.
2. **Re-Anchor**: Initialize a new session loading only:
   - The `System Prompt`.
   - The `Bridge Block` (the last memory pushed).
3. **Resume**: The agent wakes up with a clean slate but with a perfect, surgical link to the previous state.

---

## 🧭 4. Navigation Patterns

Depending on the goal, the agent should use different navigation modes:

| Mode | Goal | Tool Sequence |
| :--- | :--- | :--- |
| **Analytical** | Understand a specific logic/feature | `pullMemory(key=X)` $\rightarrow$ `direction="down"` (details) $\rightarrow$ `direction="up"` (context). |
| **Narrative** | Understand how we got here | `pullMemory(direction="prev")` $\rightarrow$ `pullMemory(direction="prev")` (walking back in time). |
| **Discovery** | Find related concepts | `pullMemory(key=X)` $\rightarrow$ Check "Referenced by" footer $\rightarrow$ Jump to cited IDs. |

---

## ⚠️ 5. Conflict Resolution & Safety

When the agent encounters a contradiction between a "Tattoo" (LTM) and a current observation (STM):

1. **Freeze**: Stop the current implementation.
2. **Flag**: Emit a `CRITICAL_INCONSISTENCY` warning.
3. **Analyze**: Compare the timestamp of the Tattoo vs. the current observation.
4. **Resolve**: 
   - If the Tattoo is outdated $\rightarrow$ Propose an update to the Tattoo via `pushMemory(scope="tattoo", ...)` after user approval.
   - If the observation is a hallucination $\rightarrow$ Correct the internal state using the Tattoo as the source of truth.

---

## 🏁 6. Summary Checklist for the Agent
- [ ] Did I run `pullMemory()` at the start?
- [ ] Did I check if this task was already done in the graph?
- [ ] Did I push a fractal node for this key discovery?
- [ ] Is my context window getting full? (If yes $\rightarrow$ Synthesize & Push).
- [ ] Did I cite previous nodes in my new memory?