# Plan: Dynamic Context Management and Rate Limiting

## Objective
Optimize API usage (Free Tier: 15 RPM / 250k TPM) through an adaptive Rate Limiter and FIFO context management, ensuring system stability and configuration persistence.

## Specifications
- **Command**: `/w <tokens> <rpm_limit>`
  - `<tokens>`: Sets the maximum context window size.
  - `<rpm_limit>`: Sets the maximum requests allowed per minute.
- **Persistence**: Values configured via `/w` will be stored in `config/config.json` to maintain settings across sessions.
- **Adaptive Rate Limiter**:
  - Implement a **60-second sliding window** (matching Gemini API behavior).
  - Use the `<rpm_limit>` provided by the user (default: 15).
  - If the limit is reached, calculate the exact time remaining until the oldest request slot expires to avoid unnecessary idle time.

## Context Management Strategy (The Context Jump)
- **Mechanism**: Instead of FIFO purging, the system implements a **Hard Reset** triggered by the Memento Bridge.
- **The Jump Sequence**: 
  1. When tokens $\approx$ 100%, the agent must have already pushed a "Bridge Block" to the Memento.
  2. The system clears the history (`history = []`).
  3. The system re-injects the `System Prompt` and the content of the `Bridge Block` as the first message of the new session.
- **System Prompt Immutability**: The System Instruction is always re-loaded during the Jump to ensure identity persistence.
- **Token Precision**: The Gemini API `count_tokens` method is used to trigger the Distillation (80%) and the Bridge (95%) phases.

## Architectural Constraints
- **TPM/RPM Balance**: The system relies on the relationship $	ext{RPM} 	imes 	ext{Window Size} \le 	ext{TPM}$. 
  - The user is responsible for balancing these values via `/w` to avoid `429 TPM` errors.
  - Example: 15 RPM $	imes$ 16k tokens $pprox$ 240k TPM (Safe).
  - Example: 2 RPM $	imes$ 100k tokens $pprox$ 200k TPM (Safe).

## Sinergia con el Sistema Memento

El mecanismo de purga FIFO descrito en este documento es el disparador técnico para la metodología Memento. 

- **El Conflicto**: La purga automática elimina la historia, lo que puede causar pérdida de objetivos y "alucinaciones" por falta de contexto.
- **La Solución**: El agente debe monitorear el conteo de tokens (vía `count_tokens`). Cuando el sistema se acerque al `context_window_limit` (específicamente al 80%), el agente debe ejecutar el flujo de **Memory Flush** definido en `memento_operational_guide.md` antes de que la purga FIFO elimine la información vital.
- **Flujo**: `Token Count > 80%` $\rightarrow$ `Agent Synthesis` $\rightarrow$ `pushMemory()` $\rightarrow$ `FIFO Purge (System)` $\rightarrow$ `Awakening (Agent)`.

## Architectural Impact
- **`paser/core/chat_manager.py`**:
  - Add `self.request_timestamps: List[float]` to track the sliding window.
  - Implement `_wait_for_rate_limit()` to calculate the required delta based on the oldest timestamp and the current `rpm_limit`.
  - Integrate `_enforce_context_limit()` before each `assistant.send_message` call.
  - **Critical**: If `_enforce_context_limit()` modifies the history, it must trigger `assistant.refresh_session()` to synchronize the SDK's internal state with the purged local history.
- **`paser/infrastructure/gemini/adapter.py`**:
  - Implement `refresh_session()`: A method that re-initializes `self.chat` using `self.client.chats.create(history=self.history, ...)` to force the SDK to forget purged messages.
- **`paser/config/config_manager.py`**:
  - Add support for reading/writing `context_window_limit` and `rpm_limit` in the configuration file.