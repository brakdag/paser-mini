class FavoriteCommands:
    @staticmethod
    def handle_fav(chat_manager, ui, parts):
        favorites = chat_manager.config_manager.get("favorites", [])
        if len(parts) == 1:
            if not favorites:
                ui.display_info(
                    "No favorite models saved. Use /fav+ to add the current one."
                )
                return True
            header = "| ID | Model (Provider) | Temp |\n|---|---|---|\n"
            rows = []
            for i, f in enumerate(favorites):
                m = f"{f['model']} ({f['provider']})"
                t = f["temp"]
                rows.append(f"| {i} | {m} | {t} |")
            ui.display_panel("Favorite Models", header + "\n".join(rows), style="green")
            return True
        elif parts[1] == "+":
            provider = chat_manager.config_manager.get("provider", "Gemini")
            model = chat_manager.assistant._current_model
            temp = chat_manager.temperature
            new_fav = {"provider": provider, "model": model, "temp": temp}
            if new_fav not in favorites:
                favorites.append(new_fav)
                chat_manager.save_config("favorites", favorites)
                ui.display_info(f"Added to favorites: {provider} | {model}")
            else:
                ui.display_info("Model already in favorites.")
            return True
        elif parts[1].startswith("-"):
            try:
                idx = int(parts[1][1:])
                if 0 <= idx < len(favorites):
                    removed = favorites.pop(idx)
                    chat_manager.save_config("favorites", favorites)
                    ui.display_info(f"Removed from favorites: {removed['model']}")
                else:
                    ui.display_error("Invalid index.")
            except (ValueError, IndexError):
                ui.display_error("Usage: /fav -<index>")
            return True
        else:
            try:
                idx = int(parts[1])
                if 0 <= idx < len(favorites):
                    fav = favorites[idx]
                    from src.infrastructure.gemini.adapter import GeminiAdapter
                    from src.infrastructure.nvidia.adapter import NvidiaAdapter

                    providers = {"Gemini": GeminiAdapter, "NVIDIA": NvidiaAdapter}
                    provider_name = fav["provider"]
                    if provider_name not in providers:
                        ui.display_error(f"Unknown provider: {provider_name}")
                        return True
                    if chat_manager.config_manager.get("provider") != provider_name:
                        chat_manager.assistant = providers[provider_name]()
                        chat_manager.save_config("provider", provider_name)
                    chat_manager.save_config("model_name", fav["model"])
                    chat_manager.save_config("default_temperature", fav["temp"])
                    chat_manager.temperature = fav["temp"]
                    chat_manager.assistant.start_chat(
                        fav["model"], chat_manager.system_instruction, fav["temp"]
                    )
                    ui.display_info(
                        f"Loaded favorite {idx}: {provider_name} | {fav['model']} | Temp: {fav['temp']}"
                    )
                else:
                    ui.display_error("Favorite index not found.")
            except (ValueError, IndexError):
                ui.display_error("Usage: /fav <index> or /fav+ or /fav -<index>")
            return True
