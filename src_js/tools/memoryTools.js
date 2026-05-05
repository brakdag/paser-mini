import { MementoManager } from '../infrastructure/memento/manager.js';

const memento = new MementoManager();

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