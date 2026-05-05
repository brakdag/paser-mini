import { GeminiAdapter } from '../infrastructure/gemini/adapter.js';

export class FavoriteCommands {
  static async handleFav(chatManager, ui, parts) {
    let favorites = chatManager.configManager.get('favorites', []);

    if (parts.length === 1) {
      if (favorites.length === 0) {
        ui.displayInfo('No favorite models saved. Use /fav+ to add the current one.');
        return true;
      }

      let header = '| ID | Model (Provider) | Temp | ID | Model (Provider) | Temp |\n|---|---|---|---|---|---|\n';
      let rows = [];
      for (let i = 0; i < favorites.length; i += 2) {
        const f1 = favorites[i];
        const m1 = `${f1.model} (${f1.provider})`;
        const t1 = f1.temp;

        if (i + 1 < favorites.length) {
          const f2 = favorites[i + 1];
          const m2 = `${f2.model} (${f2.provider})`;
          const t2 = f2.temp;
          rows.push(`| ${i} | ${m1} | ${t1} | ${i + 1} | ${m2} | ${t2} |`);
        } else {
          rows.push(`| ${i} | ${m1} | ${t1} | | | |`);
        }
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

        if (providerName !== 'Gemini') {
          ui.displayError(`Provider ${providerName} not yet implemented in JS port.`);
          return true;
        }

        chatManager.configManager.save('provider', providerName);
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
