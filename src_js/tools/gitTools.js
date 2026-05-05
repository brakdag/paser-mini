import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const git_diff = async () => {
  try {
    const { stdout } = await execPromise('git diff');
    return stdout || 'No hay cambios.';
  } catch (e) {
    return `ERR: Git diff error: ${e.stderr || e.message}`;
  }
};

export const get_current_repo = async () => {
  try {
    const { stdout } = await execPromise('git remote get-url origin');
    const url = stdout.trim();
    const match = url.match(/[:/]([^/]+/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : '';
  } catch (e) {
    return '';
  }
};

export const restore_file = async ({ path: filePath }) => {
  try {
    await execPromise(`git restore -- ${filePath}`);
    return `File '${filePath}' successfully reverted.`;
  } catch (e) {
    return `ERR: Error reverting file '${filePath}': ${e.stderr || e.message}`;
  }
};