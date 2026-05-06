# Memento: The Cognitive Graph Memory System

Memento is Paser Mini's long-term memory (LTM) system. Unlike the volatile short-term memory of the context window, Memento allows the agent to store, retrieve, and navigate knowledge across sessions using a graph-based SQLite implementation.

## ⚛️ Core Concepts

### 1. Memory Types
- **Vital Tattoos (`scope='tattoo'`)**: Core truths, identity, and fundamental constraints. These are the "DNA" of the agent and are always retrieved during the Mirror effect.
- **Fractals (`scope='fractal'`)**: General knowledge, technical insights, and session summaries. These are the "experiences" and "learnings" of the agent.

### 2. The Mirror Effect
The **Mirror** is the agent's awakening sequence. By calling `pullMemory()` without arguments, the agent retrieves:
- All **Vital Tattoos**.
- The **Root Summary** (the most recent high-level state of the project).

This ensures the agent never "forgets" who it is or what it is doing after a context reset.

## ⚙️ How to Use

### Storing Knowledge (`pushMemory`)
Use this tool to save insights that should survive a context wipe.
- **Example (Tattoo)**: `pushMemory(scope="tattoo", value="The project must always follow PEP 8 strictly.")`
- **Example (Fractal)**: `pushMemory(scope="fractal", value="The database connection is handled in database.py using a persistent connection.", key="db_connection")`

### Retrieving Knowledge (`pullMemory`)
- **The Mirror**: `pullMemory()` $\rightarrow$ Get identity and root state.
- **Specific Node**: `pullMemory(key="db_connection")` $\rightarrow$ Get a specific insight.
- **Navigation**:
    - `direction="next"` / `"prev"`: Walk through the narrative history of memories.
    - `direction="up"` / `"down"`: Move between abstract summaries and detailed nodes.

## 🌅 Advanced Workflows

### The Context Jump
To maintain peak reasoning, Paser Mini avoids context saturation through a three-phase process:
1. **Distillation**: Extracting key knowledge into fractal nodes as the window fills (approx. 80% capacity).
2. **The Bridge**: Creating a `BRIDGE: [Summary]` node that links the current state to the next session (approx. 95% capacity).
3. **The Leap**: Clearing the context and re-initializing using the Bridge node to start fresh without losing progress.

## 🔴 Navigation Summary

| Goal | Strategy |
| :--- | :--- |
| **Identity/Status** | Call `pullMemory()` (Mirror) |
| **Fact Check** | `pullMemory(key="...")` |
| **History** | `pullMemory(direction="prev")` |
| **Deep Dive** | `pullMemory(key="...")` $\rightarrow$ `direction="down"` |