# Implementation Plan: Automatic RPM (SARPM)

## Objective
Implement a dynamic RPM (Requests Per Minute) adjustment system based on a target TPM (Tokens Per Minute) to prevent API rate limit errors as the context window grows.

## Logic
- **Target TPM**: User-defined limit of tokens per minute.
- **Baseline Tokens**: 1,000 tokens (minimum assumed size of a request).
- **Formula**: `current_rpm = max(1, floor(tpm_limit / max(current_context_tokens, 1000)))`
- **Trigger**: The RPM limit is recalculated every time `_wait_for_rate_limit` is called if `auto_rpm_enabled` is True.

## Changes

### 1. `paser/core/chat_manager.py`
- Add `self.tpm_limit` and `self.auto_rpm_enabled` to `__init__` (load from `config_manager`).
- Update `_wait_for_rate_limit` to recalculate `self.rpm_limit` when `auto_rpm_enabled` is True.

### 2. `paser/core/commands.py`
- Implement `/tpm <TPM>` command:
    - Validates input is an integer.
    - Sets `tpm_limit` in config.
    - Sets `auto_rpm_enabled = True` in config.
    - Updates `ChatManager` attributes.
    - Displays confirmation message.
- Update `/help` to include the new command.

### 3. `paser/core/config_manager.py`
- No changes needed as it's a generic key-value store.

## Verification
- Run the agent.
- Use `/tpm 15000`.
- Use `/t` to check tokens.
- Verify that as tokens increase, the effective RPM limit decreases (can be verified via logs in `_wait_for_rate_limit`).