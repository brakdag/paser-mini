import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/configManager.js';

const execPromise = promisify(exec);
const config = new ConfigManager();

export const newAgent = async ({ message = null, args = [] }) => {
  try {
    const timeout = config.get('instance_timeout', 300);
    let cmd = `node src_js/main.js --instance-mode`;
    
    if (message) cmd += ` -m "${message}"`;
    if (args.length > 0) cmd += ` ${args.join(' ')}`;

    const { stdout, stderr } = await execPromise(cmd, { timeout: timeout * 1000 });
    return `Nueva instancia finalizada.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
  } catch (e) {
    return `ERR: Error al lanzar la nueva instancia: ${e.message}`;
  }
};