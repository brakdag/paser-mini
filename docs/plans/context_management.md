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

## Context Management Strategy (FIFO)
- **Mechanism**: Automatic purging of old messages when the total token count exceeds `context_window_limit`.
- **System Prompt Immutability**: The System Instruction is sacred; it must be strictly excluded from any purging process to prevent the agent from losing its identity or operational protocol.
- **Token Precision**: The Gemini API `count_tokens` method will be used to obtain the exact count of the current window, eliminating the risk of errors from manual estimations.

## Architectural Constraints
- **TPM/RPM Balance**: The system relies on the relationship $	ext{RPM} 	imes 	ext{Window Size} \le 	ext{TPM}$. 
  - The user is responsible for balancing these values via `/w` to avoid `429 TPM` errors.
  - Example: 15 RPM $	imes$ 16k tokens $pprox$ 240k TPM (Safe).
  - Example: 2 RPM $	imes$ 100k tokens $pprox$ 200k TPM (Safe).

## Architectural Impact
- **`paser/core/chat_manager.py`**:
  - Add `self.request_timestamps: List[float]` to track the sliding window.
  - Implement `_wait_for_rate_limit()` to calculate the required delta based on the oldest timestamp and the current `rpm_limit`.
  - Integrate `_enforce_context_limit()` before each `assistant.send_message` call, utilizing the token counting API.
- **`paser/config/config_manager.py`**:
  - Add support for reading/writing `context_window_limit` and `rpm_limit` in the configuration file.