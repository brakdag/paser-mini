# 🚀 Paser Mini Roadmap & Implementation Plan

## 🎯 Objective
Transform Paser Mini into a high-performance, asynchronous, and cognitively stable autonomous agent.

## 🚀 Phase 1: Infrastructure (The Foundation)
- [x] Refactor `GeminiRestClient` to use `httpx.AsyncClient`.
- [x] Convert `_request`, `generate_content`, and `_stream_request` to `async def`.
- [x] Implement `AsyncClient` lifecycle management (proper `close()` handling).
- [x] Update `GeminiAdapter` (and any other adapters) to `await` the client calls.

## 🚀 Phase 2: Core Orchestration (The Engine)
- [x] Update `ExecutionEngine` to handle async tool execution and assistant calls.
- [x] Ensure `asyncio.to_thread` is used only where strictly necessary for blocking I/O.
- [x] Implement `asyncio.Task` tracking for the current agent turn to enable cancellation.

## 🚀 Phase 3: Message Queue & State Machine (The Logic)
- [x] Implement `MessageQueue` in `ChatManager`.
- [x] Create a state machine: `IDLE` → `PROCESSING` → `FLUSHING`.
- [x] Implement "Auto-Flush" logic: automatically send queued messages after a response is completed.
- [x] Implement message aggregation (merging multiple queued messages into one prompt).

## 🚀 Phase 4: UI Decoupling & UX (The Interface)
- [x] Refactor `TerminalUI` to decouple the input loop from the response rendering.
- [x] Ensure the input prompt remains active/available during AI processing.
- [x] Fix the "Stop" button by implementing `task.cancel()` on the active agent turn.
- [x] Add visual indicators for "AI Thinking" vs "Queueing Messages".

## 🚀 Phase 5: Stability & Performance (The Polish)
- [x] **Optimize `MementoDB`**: Implement thread-local connection pooling to reduce overhead.
- [ ] **Concurrency Validation**: Stress test `MementoDB` (SQLite WAL) for async concurrency and locks.
- [ ] **Message Queue Stress Test**: Test with rapid-fire inputs.
- [ ] **Memory Profiling**: Verify memory usage during long async sessions.
- [ ] Final performance profiling.

## 🚀 Phase 6: Alignment & Hygiene
- [ ] **Doc Sync**: Align all documentation (especially `PROJECT_STRUCTURE.md`) with the `src/` layout.
- [ ] **Toolset Completeness**: Ensure `docs/TOOLS.md` is fully exhaustive.
- [ ] **Workspace Cleanup**: Ensure root directory is clean and all files are in correct folders.