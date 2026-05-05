import { MementoManager } from '../infrastructure/memento/manager.js';

const memento = new MementoManager();

let currentAssistant = null;
let currentChatManager = null;

export const setMemoryContext = (assistant, chatManager) => {
  currentAssistant = assistant;
  currentChatManager = chatManager;
};

export const push_memory = async ({ role, scope, value, key, pointers }) => {
  try {
    return await memento.pushMemory(role, scope, value, key, pointers);
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const pull_memory = async ({ scope, key, direction }) => {
  try {
    return await memento.pullMemory(scope, key, direction);
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const get_token_count = async () => {
  try {
    if (!currentAssistant) {
      return 'ERR: Assistant not initialized in memory tools.';
    }

    const count = await currentAssistant.countTokens(currentAssistant.history);
    const limit = currentChatManager?.contextWindowLimit || 250000;

    const percentage = (count / limit) * 100;
    return `Current tokens: ${count} / ${limit} (${percentage.toFixed(2)}%)`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};