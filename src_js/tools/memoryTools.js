import { MementoManager } from '../infrastructure/memento/manager.js';

const memento = new MementoManager();

let currentAssistant = null;
let currentChatManager = null;

export const setMemoryContext = (assistant, chatManager) => {
  currentAssistant = assistant;
  currentChatManager = chatManager;
};

export const pushMemory = async ({ role, scope, value, key, pointers }) => {
  try {
    return await memento.pushMemory(role, scope, value, key, pointers);
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const pullMemory = async ({ scope, key, direction }) => {
  try {
    return await memento.pullMemory(scope, key, direction);
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const getTokenCount = async () => {
  try {
    if (!currentAssistant || !currentChatManager) {
      return 'ERR: Memory context not initialized.';
    }

    // Local fast estimation: character count / 4 (matches RPD-saving strategy)
    const historyData = typeof currentAssistant.history === 'string' 
      ? currentAssistant.history 
      : JSON.stringify(currentAssistant.history || []);
    
    const count = Math.ceil(historyData.length / 4);
    const limit = currentChatManager.contextWindowLimit || 250000;

    const percentage = (count / limit) * 100;
    return `Current tokens (est.): ${count} / ${limit} (${percentage.toFixed(2)}%)`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};