import fs from 'fs/promises';
import path from 'path';

export const read_file = async ({ path: filePath }) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const write_file = async ({ path: filePath, content }) => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return 'OK';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const list_dir = async ({ path: dirPath }) => {
  try {
    const files = await fs.readdir(dirPath);
    return files.join('\n');
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};