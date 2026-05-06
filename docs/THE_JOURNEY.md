# 🚀 The Life Cycle of a Prompt: A Journey Through Paser Mini

Welcome to the inner workings of Paser Mini. Instead of a dry technical manual, this document tells the story of a message. From the moment you type a character in your terminal to the moment the AI responds, a complex but minimalist dance occurs across several files.

---

## 🌅 Phase 1: The Awakening (Startup)

Everything begins in `src/main.py`. When you run `paser-mini`, the application doesn't just start; it orchestrates an ecosystem:

1. **The UI is born**: `TerminalUI` is initialized to handle the colors, spacing, and input of your terminal.
2. **The Brain is wired**: `ChatManager` is created. It acts as the conductor of the entire orchestra.
3. **The Connection is established**: Inside `ChatManager`, the `GeminiAdapter` (in `src/infrastructure/gemini/adapter.py`) is initialized. This is the bridge between your local machine and Google's servers.
4. **The Memory is loaded**: The system checks your configuration and prepares the `system_instruction` (the "personality" of the agent).

Now, the system enters a loop, waiting for you. The cursor blinks. You are in control.

---

## 🛣️ Phase 2: The Crossroads (The Input)

You type something and press **Enter**. This string of text is captured by `ui.request_input()` and handed over to `ChatManager.run()`.

At this point, the system reaches a **Bifurcation**. It asks: *"Is this a command or a conversation?"*

### 🛠️ Path A: The Command Shortcut (e.g., `/config`)

If your input starts with a `/`, it's a command. It doesn't need to travel to the cloud; it's handled locally for maximum speed.

1. **The Gatekeeper**: `ChatManager` sends the input to `CommandHandler` (`src/core/commands.py`).
2. **The Specialist**: The `CommandHandler` looks at the command. For `/config`, it routes the request to `src/core/command_handlers/config.py`.
3. **The Action**: The handler modifies a setting in `ConfigManager` or retrieves a value.
4. **The Delivery**: The result is sent directly to `TerminalUI` to be printed on your screen.

**Total travel time**: Milliseconds. **Cloud cost**: 0 tokens.

---

### 🌌 Path B: The Great Voyage (e.g., "Hola, ¿qué tal?")

If you type natural language, you've just started a journey to the cloud. This is where the real magic happens.

#### 1. The Dispatcher (`ChatManager.execute`)
`ChatManager` receives your "Hola". It doesn't know the answer, so it prepares the package for the AI.

#### 2. The Bridge (`GeminiAdapter.send_message`)
Your text travels to `src/infrastructure/gemini/adapter.py`. The adapter does three things:
- **History Check**: It attaches your previous messages so the AI remembers who you are.
- **Payload Construction**: It wraps your text in a JSON format that Google's API understands.
- **The Leap**: It hands the payload to `GeminiRestClient` (`src/infrastructure/gemini/rest_client.py`), which sends an HTTPS request to the Gemini API.

#### 3. The Oracle (Google Gemini)
Across the internet, the model processes your tokens, reasons, and generates a response.

#### 4. The Return Trip
The API sends back a JSON response. The `GeminiAdapter` captures it, extracts the text, and saves it in the local `self.history` so the conversation can continue.

---

## 🔄 Phase 3: The Loop of Action (The ReAct Pattern)

But wait! What if you asked: *"What files are in this folder?"* The AI can't see your files... unless it uses a **Tool**.

1. **The Detection**: Before showing the response to you, `ChatManager` passes the AI's text through the `SmartToolParser` (`src/core/smart_parser.py`).
2. **The Discovery**: The parser finds a `<TOOL_CALL>` tag. The AI is saying: *"I need to use `listDir` to answer this!"*
3. **The Execution**: `ChatManager` hands the call to the `ExecutionEngine` (`src/core/execution_engine.py`), which finds the actual Python function in `src/tools/file_tools.py`.
4. **The Feedback**: The tool returns the list of files. This result is wrapped in a `<TOOL_RESPONSE>` and sent **back to the AI**.
5. **The Final Answer**: The AI reads the tool's output and finally says: *"The files in this folder are..."*

---

## 🏁 Phase 4: The Final Delivery

Once the AI has finished reasoning (and using any necessary tools), the final text reaches the end of the line:

1. **Cleaning**: `SmartToolParser.clean_response()` removes any internal XML tags so you don't see the "technical plumbing".
2. **Formatting**: `TerminalUI` adds spacing and colors to make the text readable.
3. **The Reveal**: The text appears on your screen.

**The journey is complete.** The system returns to the loop, the cursor blinks, and it waits for your next move.

---

### 🗺️ Quick Map for Developers

| Step | File | Role |
| :--- | :--- | :--- |
| **Start** | `src/main.py` | Entry point & Orchestration |
| **Input** | `src/core/chat_manager.py` | The Conductor |
| **Commands** | `src/core/commands.py` | Local logic handler |
| **API Bridge** | `src/infrastructure/gemini/adapter.py` | Cloud communicator |
| **Parsing** | `src/core/smart_parser.py` | Tool call detector |
| **Execution** | `src/core/execution_engine.py` | Tool runner |
| **Output** | `src/core/terminal_ui.py` | Visual delivery |