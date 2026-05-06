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
    config.save('agent_nickname', newNickname);
    return `Nickname updated to: ${newNickname}`;
  } catch (e) {
    return `ERR: Failed to update nickname: ${e.message}`;
  }
};

