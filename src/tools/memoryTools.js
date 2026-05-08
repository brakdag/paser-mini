--- HASH: a7447aa0e9d0573d8f333f308e6cf1dd5b320fb8a74302939fc85e312ce63ef3 ---
import { MementoManager } from '../infrastructure/memento/manager.js';

const memento = new MementoManager();

let currentAssistant = null;
let currentChatManager = null;

export const setMemoryContext = (assistant, chatManager) => {
  currentAssistant = assistant;
  currentChatManager = chatManager;
};

export const pushMemory = async (args) => {
  try {
    // Support both string shorthand and structured object
    const { 
      role = 'agent', 
      scope = 'general', 
      value, 
      key = null 
    } = typeof args === 'string' ? { value: args } : (args || {});

    if (value === undefined || value === null) {
      return 'ERR: No value provided for memory.';
    }

    // Ensure value is a string to prevent crashes in _incrementReferencedRanks
    const stringValue = String(value);

    return await memento.pushMemory(role, scope, stringValue, key);
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
    const systemInstruction = currentChatManager.systemInstruction || '';
    const historyData = typeof currentAssistant.history === 'string' 
      ? currentAssistant.history 
      : JSON.stringify(currentAssistant.history || []);
    
    const totalLength = systemInstruction.length + historyData.length;
    const count = Math.ceil(totalLength / 4);
    const limit = currentChatManager.contextWindowLimit || 250000;

    const percentage = (count / limit) * 100;
    return `Current tokens (est.): ${count} / ${limit} (${percentage.toFixed(2)}%)`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};