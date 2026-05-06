class ModelCommands:
    @staticmethod
    async def handle_models(chat_manager, ui, parts):
        # Now we await the coroutine to get the actual list of models
        models = await chat_manager.assistant.get_available_models()
        unavailable = chat_manager.config_manager.get("unavailable_models", [])

        if len(parts) == 1:
            header = "| ID | Model | ID | Model |\n|---|---|---|---|\n"
            rows = []
            for i in range(0, len(models), 2):
                m1 = models[i]
                if m1 in unavailable:
                    m1 = f"~~{m1}~~"
                m2 = ""
                idx2 = ""
                if i + 1 < len(models):
                    m2 = models[i + 1]
                    if m2 in unavailable:
                        m2 = f"~~{m2}~~"
                    idx2 = str(i + 1)
                rows.append(f"| {i} | {m1} | {idx2} | {m2} |")
            ui.display_message(
                f"Available models (~~ = unavailable):\n\n{header}" + "\n".join(rows)
            )
            return True

        # Handle model selection logic
        try:
            idx = int(parts[1])
            model_name = models[idx]
            new_temp = float(parts[2]) if len(parts) >= 3 else chat_manager.temperature
            chat_manager.save_config("model_name", model_name)
            chat_manager.save_config("default_temperature", new_temp)
            chat_manager.temperature = new_temp
            chat_manager.assistant.start_chat(
                model_name, chat_manager.system_instruction, new_temp
            )
            ui.display_info(f"Modelo cambiado a {model_name} | Temperatura: {new_temp}")
        except (ValueError, IndexError):
            ui.display_error("Invalid model index or temperature.")
        return True
