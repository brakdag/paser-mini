# Tool Response Attribution Fix

## Objective
Ensure that tool responses are displayed as coming from `<system>` instead of the user's nickname in both the terminal and the session log.

## Technical Approach
Modify `src/utils/ircFormatter.js` to detect the `<TOOL_RESPONSE>` tag at the beginning of of the message text. If detected, the nickname override to `system` will be applied.

## Implementation Steps
1. **Modify `src/utils/ircFormatter.js`**:
   - Update `formatMessage` to check if `text` starts with `<TOOL_RESPONSE>`.
   - Update `formatTerminalMessage` to check if `text` starts with `<TOOL_RESPONSE>`.
   - If the condition is met, set `nickname = "system"`.

## Verification
- Execute a tool call and verify that the output is attributed to `<system>` in the terminal and `log/session.log`.