# Implementation Plan: --github-mode

## Overview
Transform `paser-mini` into an autonomous maintenance agent that uses GitHub Issues as its primary interface. The agent will detect requests for help, plan a solution, execute it, and interact with the user via comments.

## Core Workflow
1. **Detection**: Scan for open issues containing `#ai-assistance` and NOT having the `paser-processing` label.
2. **Acknowledgment**: 
    - Post a comment with a preliminary analysis and a detailed step-by-step plan.
    - Add the `paser-processing` label to the issue.
3. **Execution Loop**:
    - Perform engineering tasks (analyze, edit, test).
    - **Interruption Check**: Periodically check for new user comments.
    - **Feedback Integration**: If a user comments, analyze the feedback, adjust the plan, and respond to the user.
    - **Heartbeat**: Post progress updates for long-running tasks.
4. **Completion**:
    - Post a final summary of changes and verification results.
    - Remove the `paser-processing` label.
    - Leave the issue open for human verification and closure.

## Technical Specifications

### 1. CLI & Entry Point
- [ ] Add `--github-mode` flag to the argument parser.
- [ ] Implement a separate entry point for GitHub mode to bypass the interactive CLI.

### 2. GitHub Integration Layer
- [ ] Implement `list_eligible_issues()`: Filter by `#ai-assistance` and absence of `paser-processing`.
- [ ] Implement `post_comment(issue_id, text)`.
- [ ] Implement `manage_label(issue_id, label, action='add'|'remove')`.
- [ ] Implement `get_latest_comments(issue_id)` to detect user feedback.

### 3. The Orchestrator (The Main Loop)
- [ ] Create a `GitHubModeOrchestrator` class to manage the state of the current issue being solved.
- [ ] Implement the logic to transition from *Detection* $
ightarrow$ *Planning* $
ightarrow$ *Execution* $
ightarrow$ *Reporting*.
- [ ] Integrate the agent's core loop into the orchestrator.

### 4. Interaction & Feedback Loop
- [ ] Implement the "Interruption Check" every $N$ turns of the agent.
- [ ] Create a mechanism for the agent to "pivot" its plan based on user comments.
- [ ] Implement the "Liveness Response" (responding to "Are you still there?").

### 5. Safety & Robustness
- [ ] **Global Timeout**: Implement a hard process timeout (e.g., 10-15 mins) to prevent zombie processes.
- [ ] **Stale Lock Recovery**: If an issue has `paser-processing` but no activity for X hours, allow a new instance to take over.
- [ ] **Git Conflict Handling**: If a push fails due to conflicts, abort the current issue, remove the label, and let the next cron run handle it.

## Verification Steps
- [ ] **Smoke Test**: Create an issue with `#ai-assistance` and verify the bot acknowledges and plans.
- [ ] **Interaction Test**: Comment on an active issue and verify the bot adjusts its behavior.
- [ ] **Robustness Test**: Simulate a crash/timeout and verify the stale lock recovery.
- [ ] **End-to-End Test**: Full cycle from issue creation to final report.

## Future Upgrades: Professional PR Workflow

### Goal
Move from direct commits to a Pull Request workflow using a dedicated Bot account to maintain a clean separation between AI-generated changes and human history.

### Technical Requirements
- [ ] **Bot Identity**: Configure the system to use a separate GitHub token for a dedicated bot account.
- [ ] **Branching Strategy**: Implement automatic branch creation for each issue (e.g., `paser-fix/issue-X`).
- [ ] **PR Integration**: 
    - Add `create_pull_request()` to `github_tools.py`.
    - Update the orchestrator to push the feature branch and open a PR to the main branch.
- [ ] **Updated Reporting**: Modify the final issue comment to include a direct link to the created Pull Request instead of just a summary of changes.
- [ ] **Human-in-the-loop Merge**: Ensure the bot never merges its own PRs, leaving the final approval and merge to the human maintainer.