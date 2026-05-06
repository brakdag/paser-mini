import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const getCurrentRepo = async () => {
  try {
    const { stdout } = await execPromise('git remote get-url origin');
    const url = stdout.trim();
    const match = url.match(/[:\/]([^\/]+\/[^\/]+?)(?:\.git)?$/);
    return match ? match[1] : '';
  } catch (e) {
    return '';
  }
};