# Essential User Commands

These commands are handled locally by the `CommandHandler` and do not consume tokens (unless they trigger an AI interaction like `/paim`).

### ⚙️ System & Session Control

- `/help`: Display the full list of available commands.
- `/q`, `/quit`, `/exit`, `:q`: Gracefully terminate the application.
- `/clear`: Clear the terminal screen.
- `/reset`: Perform a **Hard Reset**. Clears history and attempts to restore state via the latest Memento Bridge Block (The Leap).
- `/connect`: Manually switch between LLM providers (e.g., Gemini, NVIDIA, Cohere).

### 💠 Configuration & Tuning

- `/config`: View and modify the current system configuration.
- `/models <index> [temperature]`: Change the active AI model and adjust the temperature.
- `/fav <index|+|-index>`: Manage favorite models (shortcuts for quick switching).
- `/variants <index>`: List or switch between available model variants for the current provider.
- `/w <tokens> <rpm> <tpm>`: Set limits for the context window, Requests Per Minute, and Tokens Per Minute.

### 📋 Debugging & Data

- `/s [filename]`: Save the **raw** last request payload (the exact JSON object sent to the server) to a JSON file (defaults to `last_request.json`). Essential for forensic analysis.
- `/mchk`: Scans all available models to check their current availability and updates the unavailable list.
- `/sp`: Displays the current System Prompt/Instructions.

### 👍 Interaction, Roleplay & Modes

- `/r <message>`: **Rewrite**. Removes the last interaction and re-prompts the agent with a new message.
- `/nick <name>`: Change your nickname in the session.
- `/topic <text>`: Change the current channel topic.
- `/me <action>`: Perform an action in asterisks (e.g., `/me sighs deeply`), sending it as a roleplay event to the AI.
- `/action <text>`: Perform a screenplay-style action (Fountain mode).
- `/join <channel>`: Joins or creates a virtual channel.
- `/paim <prompt>`: Invokes the internal Paimal AI assistant for meta-tasks.
- `/irc`: Switch UI rendering to IRC style.
- `/fountain`: Switch UI rendering to Screenplay (Fountain) style.
- `/clean`: Switch UI rendering to clean text only.
- `/execute [on|off]`: Toggles or sets bash execution for tools (disabled by default for security). Persists across sessions.

---

**Note**: All commands start with `/` or `:`. If a command is not recognized, the system will notify you via the `/help` menu.
