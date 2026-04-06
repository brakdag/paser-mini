# Technical Design Document: User Notification Tool

## 1. Overview
Implement a system-level tool `notify_user` that provides multi-modal feedback (auditory and visual) to the user. This tool is designed to alert the user upon completion of long-running tasks or critical events.

## 2. Functional Specifications

### 2.1 Auditory Feedback
- **Asset Path**: `/paser/assets/type.wav`
- **Behavior**: The system must trigger the playback of the specified WAV file. 
- **Constraint**: Playback must be asynchronous to prevent blocking the agent's main execution thread.

### 2.2 Visual Feedback
- **Format**: `[NerdFont Icon] [Message]`
- **Icon**: Use the Neovim-style bell icon from Nerd Fonts (e.g., `󱔗` or `󱔎`).
- **Requirement**: The output must be sent to the primary user interface stream.

## 3. Technical Implementation

### 3.1 Tool Call Definition (Catalog Specification)
Following the existing tool catalog schema, the definition is:

```json
{
    "name": "notify_user",
    "description": "Triggers a system notification with a Nerd Font bell icon and a specific sound alert.",
    "parameters": {
        "type": "object",
        "properties": {
            "mensaje": {
                "type": "string",
                "description": "The notification text to be displayed to the user."
            }
        },
        "required": ["mensaje"]
    }
}
```

### 3.2 Implementation Logic (Pseudocode)
```python
def notify_user(mensaje):
    try:
        # 1. Async sound trigger
        play_sound_async("/paser/assets/type.wav")
    except FileNotFoundError:
        log_warning("Notification sound file not found. Proceeding with visual only.")
    
    # 2. Visual output with Nerd Font glif
    notification_payload = f"󱔗 {mensaje}"
    send_to_ui(notification_payload)
    
    return {"status": "success", "message": "Notification delivered"}
```

## 4. Edge Cases & Error Handling
| Scenario | Expected Behavior |
| :--- | :--- |
| Sound file missing | Log warning and display visual notification only. |
| Terminal lacks Nerd Fonts | Display fallback character (e.g., [!] ) or raw Unicode. |
| Empty message | Use a default string: "Task completed" |
| Rapid fire calls | Implement a debouncing mechanism to avoid overlapping sounds. |

## 5. Dependencies
- **Audio Driver**: System-level audio player (e.g., `aplay`, `afplay`, or `pygame`).
- **Font**: Nerd Fonts installed in the client terminal.

---

# Pending Tasks / Roadmap

- [ ] **Implement `read_files` tool**: Create a tool to read multiple files in a single call to reduce agent turns.
    - [ ] Implement `read_files(paths: list[str])` in `paser/tools/file_tools.py` with safe path validation.
    - [ ] Register tool in `paser/tools/registry.py` (Dictionary and JSON Catalog).
    - [ ] Add UI feedback mapping in `paser/core/chat_manager.py`.
- [ ] **Fix Rich Markdown parsing with Nerd Fonts**: Resolve issues where `rich` has trouble parsing Nerd Font glyphs during markdown rendering.
- [ ] **Integrate professional spinner**: Replace current spinner implementation with `yaspin` for a standard, studied terminal loading experience.
