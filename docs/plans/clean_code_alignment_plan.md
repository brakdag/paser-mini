# Clean Code Alignment Plan

## Overview
This document outlines the violations of Clean Code principles identified in the `paser-mini` codebase and proposes corrective actions to achieve the 'Absolute Code' standard.

---

## 1. Single Responsibility Principle (SRP) Violations

### 1.1 `src/core/turnProcessor.js` - `process()` Method
- **Issue**: The `process()` method is approximately 150 lines long and handles thought extraction, tool-call parsing, Fountain mode orchestration, consecutive error tracking, iteration limits, and final response rendering. It operates at multiple levels of abstraction simultaneously.
- **Refactoring Action**: Extract distinct responsibilities into private methods:
  - `#extractThought(response)`
  - `#executeTools(calls)`
  - `#handleConsecutiveErrors(count)`
  - `#buildResultsPayload(results)`
  - `#processIteration(response)`

### 1.2 `src/core/chatManager.js` - `run()` Method
- **Issue**: The `run()` method orchestrates the main loop, handles initial message injection, logs session openings, processes commands, and catches exceptions.
- **Refactoring Action**: Extract the initialization sequence into `#initializeSession()` and the main loop into `#startMainLoop()`.

### 1.3 `src/core/terminalUI.js` - `displayChatMessage()` Method
- **Issue**: Contains complex branching for different rendering modes (FOUNTAIN, CLEAN, IRC) and handles formatting, terminal output, and file logging.
- **Refactoring Action**: Implement a Strategy Pattern for rendering modes. Extract logging into the `SessionLogger` exclusively.

---

## 2. Open/Closed Principle (OCP) Violations

### 2.1 `src/core/executionEngine.js` - `_getToolDetail()` Method
- **Issue**: Uses a massive `switch` statement to extract details from tool arguments. Every new tool requires a modification to this method.
- **Refactoring Action**: Replace the switch statement with a configuration map (e.g., `TOOL_DETAIL_EXTRACTORS`) where each key maps to a function that extracts the relevant detail string.

---

## 3. Magic Numbers and Strings

### 3.1 Iteration and Error Limits
- **Location**: `turnProcessor.js` (`maxIterations = 9999999`, `consecutiveErrors >= 5`), `chatManager.js` (`250000`, `15000`, `0.7`).
- **Action**: Extract to capitalized, named constants at the top of the respective modules or in a centralized `config/constants.js`.

### 3.2 Command Slicing
- **Location**: `commandHandler.js` (`input.slice(3)`, `input.slice(7)`, etc.).
- **Action**: Replace hardcoded slice indices with calculations based on the command prefix length or use regex capture groups.

---

## 4. Function Arguments and Complexity

### 4.1 `chatManager.js` Constructor
- **Issue**: Accepts 7 positional parameters, increasing combinatorial complexity and risking inverse dependency injection issues.
- **Action**: Consolidate into a single configuration object using ES6 destructuring.

---

## 5. Error Handling

### 5.1 Swallowed Exceptions
- **Location**: `chatManager.js` `run()` method, `try/catch` block around tool initialization.
- **Issue**: Catches and logs errors but allows the system to continue without memory tools, leading to unpredictable state.
- **Action**: Either fail fast (throw) or implement a degraded mode flag that explicitly disables memory-dependent features.

---

## 6. Formatting and Syntax

### 6.1 Inconsistent Indentation
- **Location**: `fileTools.js` (`#readTail` method).
- **Action**: Standardize indentation (2 spaces per project standard).

### 6.2 Bug in `terminalUI.js`
- **Location**: `endToolMonitoring()` method.
- **Issue**: Calls `this.activeSpinners.delete(spinner)` instead of `this.activeSpinners.delete(name)`. This fails to clean up the map entry.
- **Action**: Correct the parameter passed to `delete()`.

---

## Execution Priority
1. **Critical**: Fix the `endToolMonitoring` bug in `terminalUI.js`.
2. **High**: Refactor `_getToolDetail` in `executionEngine.js` to comply with OCP.
3. **High**: Extract constants to eliminate magic numbers.
4. **Medium**: Decompose `turnProcessor.js` and `chatManager.js` for SRP compliance.
5. **Low**: Implement Strategy Pattern for UI rendering modes.