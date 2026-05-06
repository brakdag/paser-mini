# Essential User Commands

These commands are handled locally by the `CommandHandler` and do not consume tokens.

### ⚙️ System & Session Control
- `/help`: Display the full list of available commands.
- `/q`, `/quit`, `/exit`: Gracefully terminate the application.
- `/clear`: Clear the terminal screen.
- `/reset`: Perform a **Hard Reset**. Clears history and attempts to restore state via the latest Memento Bridge Block (The Leap).
- `/compact`: Compacts the current session history into the IRC log and resets the context window.
- `/connect`: Manually switch between LLM providers (Gemini / NVIDIA).

### 💠 Configuration & Tuning
- `/config`: View and modify the current system configuration.
- `/models`: Change the active AI model and adjust the temperature.
- `/fav`: Manage favorite models (shortcuts for quick switching).
- `/w <tokens> <rpm> <tpm>`: Set limits for the context window, Requests Per Minute, and Tokens Per Minute.

### 📋 Debugging & Data
- `/s [filename]`: Save the last request payload to a JSON file (defaults to `last_request.json`). Useful for forensic analysis of AI behavior.
- `/t`: Display the current context window token usage.

### 👍 Interaction & Roleplay
- `/r <message>`: **Rewrite**. Removes the last interaction and re-prompts the agent with a new message.
- `/nick <name>`: Change your nickname in the session.
- `/topic <text>`: Change the current channel topic.
- `/me <action>`: Perform an action in asterisks (e.g., `/me sighs deeply`), sending it as a roleplay event to the AI.

---
**Note**: All commands start with `/`. If a command is not recognized, the system will notify you via the `/help` menu.