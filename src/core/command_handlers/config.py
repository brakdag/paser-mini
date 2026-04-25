class ConfigCommands:
    @staticmethod
    def handle_config(chat_manager, ui):
        config_info = (
            "| Setting | Value |\n"
            "| :--- | :--- |\n"
            f"| Model | {chat_manager.assistant._current_model} |\n"
            f"| Temperature | {chat_manager.temperature} |\n"
            f"| Context Window | {chat_manager.context_window_limit} tokens |\n"
            f"| Current Tokens | {chat_manager.assistant.count_tokens(chat_manager.assistant.get_history())} |\n"
            f"| TPM Limit | {chat_manager.tpm_limit} |\n"
            f"| RPM Limit | {chat_manager.rpm_limit} |\n"
            f"| Instance Timeout | {chat_manager.config_manager.get('instance_timeout', 300)}s |\n"
            f"| Sandbox Mode | {'ENABLED (Wasmer)' if chat_manager.config_manager.get('sandbox_mode', False) else 'DISABLED (VENV)'} |\n"
            f"| Safe Mode | {'ENABLED' if chat_manager.config_manager.get('safemode', False) else 'DISABLED'} |"
        )
        ui.display_panel("Current Configuration", config_info, style="blue")
        return True
