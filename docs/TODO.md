# ⁌ Async Migration & Message Queue Implementation Plan

## 📃 Objective
Transform Paser Mini from a synchronous, blocking agent to a fully asynchronous, event-driven system to enable non-blocking user input, a message queue, and instant interruptibility.

## 💠 Phase 1: Infrastructure (The Foundation)
- [x] Refactor `GeminiRestClient` to use `httpx.AsyncClient`.
- [x] Convert `_request`, `generate_content`, and `_stream_request` to `async def`.
- [x] Implement `AsyncClient` lifecycle management (proper `close()` handling).
- [x] Update `GeminiAdapter` (and any other adapters) to `await` the client calls.

## 💠 Phase 2: Core Orchestration (The Engine)
- [x] Update `ExecutionEngine` to handle async tool execution and assistant calls.
- [x] Ensure `asyncio.to_thread` is used only where strictly necessary for blocking I/O.
- [x] Implement `asyncio.Task` tracking for the current agent turn to enable cancellation.

## 💠 Phase 3: Message Queue & State Machine (The Logic)
- [x] Implement `MessageQueue` in `ChatManager`.
- [x] Create a state machine: `IDLE` → `PROCESSING` → `FLUSHING`.
- [x] Implement "Auto-Flush" logic: automatically send queued messages after a response is completed.
- [x] Implement message aggregation (merging multiple queued messages into one prompt).

## 💠 Phase 4: UI Decoupling & UX (The Interface)
- [x] Refactor `TerminalUI` to decouple the input loop from the response rendering.
- [x] Ensure the input prompt remains active/available during AI processing.
- [x] Fix the "Stop" button by implementing `task.cancel()` on the active agent turn.
- [x] Add visual indicators for "AI Thinking" vs "Queueing Messages".

## 💠 Phase 5: Stability & Performance (The Polish)
- [ ] Stress test the message queue with rapid-fire inputs.
- [ ] Verify memory usage during long async sessions.
- [ ] Validate that `MementoDB` (SQLite WAL) handles the async concurrency without locks.
- [ ] Final performance profiling.