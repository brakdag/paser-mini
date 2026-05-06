import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const FILE_SIZE_LIMIT = 100 * 1024;
const READ_CACHE = new Map();

// Helper para validar rutas y evitar Path Traversal
const getSafePath = (inputPath) => {
  const resolved = path.resolve(process.cwd(), inputPath);
  if (!resolved.startsWith(process.cwd())) {
    throw new Error('Security Error: Path is outside of project root');
  }
  return resolved;
};

export const readFile = async ({ path: filePath }) => {
  try {
    const safePath = getSafePath(filePath);
    const stats = await fs.stat(safePath);
    
    if (stats.size > FILE_SIZE_LIMIT) return 'ERR: File too large';
    
    const content = await fs.readFile(safePath, 'utf8');
    if (!content) return '';

    // Simple cache check
    if (READ_CACHE.get(safePath) === content) {
      return 'ERR: No changes since last read';
    }
    READ_CACHE.set(safePath, content);
    
    return content;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const writeFile = async ({ path: filePath, content }) => {
  try {
    if (Buffer.byteLength(content, 'utf8') > FILE_SIZE_LIMIT) return 'ERR: Content too large';
    const safePath = getSafePath(filePath);
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, 'utf8');
    READ_CACHE.delete(safePath);
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const listDir = async ({ path: dirPath = '.' }) => {
  try {
    const safePath = getSafePath(dirPath);
    const files = await fs.readdir(safePath);
    return files.join('\n');
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const removeFile = async ({ path: filePath }) => {
  try {
    const safePath = getSafePath(filePath);
    await fs.rm(safePath, { recursive: true, force: true });
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const create_dir = async ({ path: dirPath }) => {
  try {
    const safePath = getSafePath(dirPath);
    await fs.mkdir(safePath, { recursive: true });
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const renamePath = async ({ origen, destino }) => {
  try {
    const safeOrigen = getSafePath(origen);
    const safeDestino = getSafePath(destino);
    await fs.rename(safeOrigen, safeDestino);
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const replaceString = async ({ path: filePath, search_text, replace_text }) => {
  try {
    if (!search_text) return 'ERR: Search text cannot be empty';
    const safePath = getSafePath(filePath);
    const content = await fs.readFile(safePath, 'utf8');
    
    const count = content.split(search_text).length - 1;
    if (count === 0) return 'ERR: Not found';
    if (count > 1) return `ERR: Ambiguous: ${count} matches`;

    const newContent = content.replace(search_text, replace_text);
    if (Buffer.byteLength(newContent, 'utf8') > FILE_SIZE_LIMIT) return 'ERR: Resulting content too large';
    
    await fs.writeFile(safePath, newContent, 'utf8');
    READ_CACHE.delete(safePath);
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const copyFile = async ({ origen, destino }) => {
  try {
    const safeSrc = getSafePath(origen);
    const safeDst = getSafePath(destino);
    await fs.mkdir(path.dirname(safeDst), { recursive: true });
    await fs.copyFile(safeSrc, safeDst);
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const getTree = async () => {
  try {
    const { stdout } = await execPromise('git ls-files');
    return stdout;
  } catch (e) {
    return `ERR: Git error: ${e.message}`;
  }
};

export const gitDiff = async ({ path: filePath }) => {
  try {
    const safePath = getSafePath(filePath);
    const { stdout } = await execPromise(`git diff ${safePath}`);
    return stdout || 'No changes found.';
  } catch (e) {
    return `ERR: Git diff error: ${e.message}`;
  }
};

export const restoreFile = async ({ path: filePath }) => {
  try {
    const safePath = getSafePath(filePath);
    await execPromise(`git restore ${safePath}`);
    return 'OK';
  } catch (e) {
    return `ERR: Git restore error: ${e.message}`;
  }
};

export const codeFormatter = async ({ path: filePath }) => {
  try {
    const safePath = getSafePath(filePath);
    await execPromise(`npx black ${safePath}`);
    return 'OK';
  } catch (e) {
    return `ERR: Formatting error: ${e.message}`;
  }
};

export const concatFile = async ({ destination, source }) => {
  try {
    const safeDst = getSafePath(destination);
    const safeSrc = getSafePath(source);
    
    const dstContent = await fs.readFile(safeDst, 'utf8');
    const srcContent = await fs.readFile(safeSrc, 'utf8');
    const combined = dstContent + srcContent;
    
    if (Buffer.byteLength(combined, 'utf8') > FILE_SIZE_LIMIT) return 'ERR: Resulting file too large';
    
    await fs.writeFile(safeDst, combined, 'utf8');
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};