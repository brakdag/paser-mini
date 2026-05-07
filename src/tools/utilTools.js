import { ConfigManager } from '../core/configManager.js';

export const validateJson = async ({ json_string }) => {
  try {
    JSON.parse(json_string);
    return 'El JSON es valido.';
  } catch (e) {
    return `ERR: JSON invalido: ${e.message}`;
  }
};


export const setNickname = async ({ newNickname }) => {
  try {
    const config = new ConfigManager();
    const oldNickname = config.get('agent_nickname', 'paser_mini');
    config.save('agent_nickname', newNickname);
    return `*** ${oldNickname} is now known as ${newNickname}`;
  } catch (e) {
    return `ERR: Failed to update nickname: ${e.message}`;
  }
};

