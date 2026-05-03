# Stability & Performance Specification

## 🎯 Objective
Eliminate "stutter" in the agent's reasoning and execution loop by verifying the system's resilience under high concurrency and load.

## 1. Concurrency Validation (MementoDB)
**The Friction**: SQLite, even in WAL mode, can throw `database is locked` errors if multiple async threads attempt to write simultaneously.

- **Test Scenario**: 
    - Launch 50 concurrent `push_memory` operations using `asyncio.gather`.
    - Simultaneously perform 50 `pull_memory` (Mirror Effect) operations.
- **Success Criteria**: 
    - Zero `sqlite3.OperationalError` exceptions.
    - All 50 nodes successfully persisted and retrievable.
    - Total execution time for the batch < 2 seconds.

## 2. Message Queue Stress Test (ChatManager)
**The Friction**: Rapid-fire user inputs can lead to race conditions in the `IDLE` $\rightarrow$ `PROCESSING` $\rightarrow$ `FLUSHING` state machine, potentially causing lost messages or duplicate responses.

- **Test Scenario**: 
    - Inject 10 messages into the queue within a 500ms window while the agent is already `PROCESSING` a complex tool call.
- **Success Criteria**: 
    - All 10 messages are aggregated or queued correctly.
    - The agent processes the queue in the correct chronological order.
    - No deadlock occurs in the `Auto-Flush` logic.

## 3. Memory Profiling (Long-Session Stability)
**The Friction**: Memory leaks in the `AsyncClient` or the `MementoManager` can lead to degraded performance over long sessions.

- **Test Scenario**: 
    - Simulate a 100-turn interaction loop involving heavy file reading and memory pushing.
- **Success Criteria**: 
    - RSS memory growth remains linear and within a defined threshold (e.g., < 200MB increase).
    - No significant increase in response latency between turn 1 and turn 100.

## 4. Perceived Latency Audit
**The Friction**: The time between a tool returning 'OK' and the AI generating the next thought.

- **Metric**: Measure the delta between `tool_execution_end` and `llm_request_start` in `paser.log`.
- **Target**: $\le 100ms$ overhead.