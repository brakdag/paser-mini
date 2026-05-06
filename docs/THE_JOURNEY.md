# 🚀 The Life Cycle of a Prompt: A Journey Through Paser Mini

Welcome to the inner workings of Paser Mini. Instead of a dry technical manual, this document tells the story of a message. From the moment you type a character in your terminal to the moment the AI responds, a complex but minimalist dance occurs across several files.

---

## 🌅 Phase 1: The Awakening (Startup)

Everything begins in `src_js/main.js`. When you run `paser-mini`, the application orchestrates its ecosystem:

1. **The UI is born**: `TerminalUI` is initialized to handle colors, spacing, and input.
2. **The Brain is wired**: `ChatManager` is created, acting as the conductor of the entire orchestra.
3. **The Connection is established**: Inside `ChatManager`, the `GeminiAdapter` (in `src_js/infrastructure/gemini/adapter.js`) is initialized, bridging the local machine and Google's servers.
4. **The Memory is loaded**: The system prepares the `system_instruction` (the agent's persona).

Now, the system enters a loop, waiting for you. The cursor blinks. You are in control.

---

## 🛣️ Phase 2: The Crossroads (The Input)

You type something and press **Enter**. This text is captured by `ui.requestInput()` and handed over to `ChatManager.run()`.

At this point, the system reaches a **Bifurcation**: *"Is this a command or a conversation?"*

### 🛠️ Path A: The Command Shortcut (e.g., `/config`)

If your input starts with a `/`, it's a command handled locally for maximum speed.

1. **The Gatekeeper**: `ChatManager` sends the input to `CommandHandler` (`src_js/core/commandHandler.js`).
2. **The Specialist**: The `CommandHandler` routes the request to the specific handler (e.g., `config.js`).
3. **The Action**: The handler modifies a setting in `ConfigManager` or retrieves a value.
4. **The Delivery**: The result is sent directly to `TerminalUI` to be printed.

**Total travel time**: Milliseconds. **Cloud cost**: 0 tokens.

---

### 🌌 Path B: The Great Voyage (e.g., "Hello, how are you?")

If you type natural language, you've started a journey to the cloud.

#### 1. The Dispatcher (`ChatManager.processTurn`)
`ChatManager` receives your input and prepares the package for the AI.

#### 2. The Bridge (`GeminiAdapter.sendMessage`)
Your text travels to `src_js/infrastructure/gemini/adapter.js`. The adapter:
- **History Check**: Attaches previous messages for continuity.
- **Payload Construction**: Wraps text in the format required by the Gemini API.
- **The Leap**: Sends the payload via HTTPS request to the API.

#### 3. The Oracle (Google Gemini)
Across the internet, the model processes tokens, reasons, and generates a response.

#### 4. The Return Trip
The API sends back a JSON response. The `GeminiAdapter` extracts the text and updates the session history.

---

## 🔄 Phase 3: The Loop of Action (The ReAct Pattern)

What if you asked: *"What files are in this folder?"* The AI uses a **Tool**.

1. **The Detection**: `ChatManager` passes the AI's text through the `SmartToolParser` (`src_js/core/smartParser.js`).
2. **The Discovery**: The parser finds a `<TOOL_CALL>` tag. The AI is requesting a tool like `listDir`.
3. **The Execution**: `ChatManager` hands the call to the `ExecutionEngine` (`src_js/core/executionEngine.js`), which executes the logic in `src_js/tools/fileTools.js`.
4. **The Feedback**: The tool returns the result, which is wrapped in a `<TOOL_RESPONSE>` and sent **back to the AI**.
5. **The Final Answer**: The AI reads the output and finally provides the answer to the user.

---

## 🏁 Phase 4: The Final Delivery

Once the AI has finished reasoning:

1. **Cleaning**: `SmartToolParser.cleanResponse()` removes internal XML tags.
2. **Formatting**: `TerminalUI` applies spacing and colors.
3. **The Reveal**: The text appears on your screen.

**The journey is complete.**

---

### 🗺️ Quick Map for Developers

| Step | File | Role |
| :--- | :--- | :--- |
| **Start** | `src_js/main.js` | Entry point & Orchestration |
| **Input** | `src_js/core/chatManager.js` | The Conductor |
| **Commands** | `src_js/core/commandHandler.js` | Local logic handler |
| **API Bridge** | `src_js/infrastructure/gemini/adapter.js` | Cloud communicator |
| **Parsing** | `src_js/core/smartParser.js` | Tool call detector |
| **Execution** | `src_js/core/executionEngine.js` | Tool runner |
| **Output** | `src_js/core/terminalUI.js` | Visual delivery |