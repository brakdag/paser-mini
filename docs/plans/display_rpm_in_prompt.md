# Implementation Plan: Display RPM in Prompt

## Objective
Display the current RPM (Requests Per Minute) in the prompt to provide users with an estimate of the expected response time.

## Changes

### 1. `paser/core/chat_manager.py`
- No changes needed.

### 2. `paser/core/terminal_ui.py`
- Modify the `display_prompt` function (or equivalent) to include the RPM in the prompt string.
    - Retrieve `self.rpm_limit` from the `ChatManager` instance.
    - Format the RPM as "|RPM: X>", where X is the RPM value.
    - Prepend this string to the prompt before displaying it to the user.

## Verification
- Run the agent.
- Set RPM to automatic and fixed values.
- Verify that the RPM is displayed correctly in the prompt before each response.
- Test with varying input lengths to ensure the RPM indicator remains accurate.