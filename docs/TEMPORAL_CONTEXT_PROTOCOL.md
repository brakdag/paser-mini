# Temporal Context & Identity Protocol

## Overview

This document defines the architectural requirement for maintaining temporal and identity metadata within the LLM request payload. This protocol is a fundamental pillar of the Paser Mini ecosystem, designed to enable implicit temporal reasoning and ensure absolute transparency in communication.

## Core Principle: Information Symmetry

To prevent "informational asymmetry," the data presented to the user in the terminal must be identical to the data sent to the LLM provider (Gemini, NVIDIA, etc.). Any filtering or cleaning of timestamps and nicknames within the communication layer is strictly prohibited, as it deprives the model of essential context and invalidates forensic auditing.

## Technical Implementation

### 1. Message Structure

Every message in the conversation history must follow the structured format:
`[HH:mm] <Nickname> Message Content`

This structure is not merely for UI aesthetics; it serves as a semantic signal to the model. By including these markers, we leverage the model's pre-trained understanding of IRC and chat logs to provide:

- **Temporal Awareness**: The model can infer the passage of time and the latency of tool executions by analyzing the delta between timestamps in the history.
- **Identity Resolution**: The model can clearly distinguish between user intent and agent response without explicit role-tagging overhead.

### 2. Payload Integrity

The `_buildPayload` method in the adapter layer must **not** strip these markers, even when the UI is in `CLEAN` mode. The `CLEAN` mode is a visual preference for the user, not a data-reduction strategy for the API. The payload sent to the server must remain "raw" and structurally complete.

### 3. Observability & Forensic Auditing

The `/s` command is designed to capture the **raw payload** as it is dispatched via the HTTP request. This ensures that researchers and developers can perform forensic analysis on the exact data sent to the provider, confirming that no hidden filtering or modification has occurred.

## Rationale for Research (Thesis Foundation)

This protocol enables a low-token-cost method for providing temporal context. Instead of injecting explicit "time elapsed" parameters into every tool call (which increases token consumption and complexity), we provide a structured log that allows the model to autonomously decide when and how to use temporal information. This maximizes intelligence while minimizing friction and cost.
