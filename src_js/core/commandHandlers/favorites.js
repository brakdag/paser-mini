import { GeminiAdapter } from '../../infrastructure/gemini/adapter.js';

export class FavoriteCommands {
  static async handleFav(chatManager, ui, parts) {
    let favorites = chatManager.configManager.get('favorites', []);

    if (parts.length === 1) {
      if (favorites.length === 0) {
        ui.displayInfo('No favorite models saved. Use /fav+ to add the current one.');
        return true;
      }

      let header = '| ID | Model (Provider) | Temp |\n|---|---|---|\n';
      let rows = [];
      for (let i = 0; i < favorites.length; i++) {
        const f = favorites[i];
        const m = `${f.model} (${f.provider})`;
        const t = f.temp;
        rows.push(`| ${i} | ${m} | ${t} |`);
      }
      ui.displayMessage('--- Favorite Models ---\n' + header + rows.join('\n'));
      return true;
    }

    if (parts[1] === '+') {
      const provider = chatManager.configManager.get('provider', 'Gemini');
      const model = chatManager.assistant.currentModel;
      const temp = chatManager.temperature;
      const newFav = { provider, model, temp };

      if (!favorites.some(f => f.model === model && f.provider === provider)) {
        favorites.push(newFav);
        chatManager.configManager.save('favorites', favorites);
        ui.displayInfo(`Added to favorites: ${provider} | ${model}`);
      } else {
        ui.displayInfo('Model already in favorites.');
      }
      return true;
    }

    if (parts[1].startsWith('-')) {
      try {
        const idx = parseInt(parts[1].slice(1), 10);
        if (idx >= 0 && idx < favorites.length) {
          const removed = favorites.splice(idx, 1)[0];
          chatManager.configManager.save('favorites', favorites);
          ui.displayInfo(`Removed from favorites: ${removed.model}`);
        } else {
          ui.displayError('Invalid index.');
        }
      } catch (e) {
        ui.displayError('Usage: /fav -<index>');
      }
      return true;
    }

    try {
      const idx = parseInt(parts[1], 10);
      if (idx >= 0 && idx < favorites.length) {
        const fav = favorites[idx];
        const providerName = fav.provider;
        const currentProvider = chatManager.configManager.get('provider', 'Gemini');

        if (providerName !== currentProvider) {
          if (providerName === 'Gemini') {
            const { GeminiAdapter } = await import('../../infrastructure/gemini/adapter.js');
            chatManager.assistant = new GeminiAdapter();
          } else if (providerName === 'NVIDIA') {
            const { NvidiaAdapter } = await import('../../infrastructure/nvidia/adapter.js');
            chatManager.assistant = new NvidiaAdapter();
          } else {
            ui.displayError(`Provider ${providerName} not supported.`);
            return true;
          }
          chatManager.configManager.save('provider', providerName);
        }

        chatManager.configManager.save('model_name', fav.model);
        chatManager.configManager.save('default_temperature', fav.temp);
        chatManager.temperature = fav.temp;
        chatManager.assistant.startChat(fav.model, chatManager.systemInstruction, fav.temp);

        ui.displayInfo(`Loaded favorite ${idx}: ${providerName} | ${fav.model} | Temp: ${fav.temp}`);
      } else {
        ui.displayError('Favorite index not found.');
      }
    } catch (e) {
      ui.displayError('Usage: /fav <index> or /fav+ or /fav -<index>');
    }
    return true;
  }
}
