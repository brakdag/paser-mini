import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { registerSchemas } from '../core/schemaRegistry.js';

const execPromise = promisify(exec);

export const analyzeCode = async ({ path: targetPath = '.' }) => {
  try {
    const { stdout } = await execPromise(`npx pyright --outputjson ${targetPath}`, { timeout: 60000 });
    if (stdout.trim() === '') {
      return 'No type or syntax errors found.';
    }
    return stdout;
  } catch (e) {
    if (e.stdout) return e.stdout;
    return `ERR: Analysis error: ${e.message}`;
  }
};

export const lintCode = async ({ path: targetPath = '.' }) => {
  try {
    const { stdout } = await execPromise(`npx eslint ${targetPath} --format json`, { timeout: 60000 });
    if (!stdout || stdout.trim() === '[]') {
      return 'No linting issues found.';
    }
    return stdout;
  } catch (e) {
    if (e.stdout) return e.stdout;
    return `ERR: Linting error: ${e.message}`;
  }
};

export const generateDocs = async ({ path: targetPath = '.', outputDir = 'docs/api' }) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    await execPromise(`npx jsdoc ${targetPath} -d ${outputDir}`, { timeout: 60000 });
    return `Documentation successfully generated in: ${outputDir}`;
  } catch (e) {
    return `ERR: Documentation error: ${e.message}`;
  }
};

export const reloadSchemas = async () => {
  try {
    await registerSchemas();
    return 'Schemas successfully reloaded from disk.';
  } catch (e) {
    return `ERR: Failed to reload schemas: ${e.message}`;
  }
};

export const executeBash = async ({ command }) => {
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: process.cwd(),
      timeout: 60000,
    });
    return stdout || stderr || 'Command executed successfully (no output).';
  } catch (e) {
    if (e.stdout) return `Exit Code ${e.code}:\n${e.stdout}\n${e.stderr || ''}`;
    return `ERR: Bash error: ${e.message}`;
  }
};
