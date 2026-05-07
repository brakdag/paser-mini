import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execPromise = promisify(exec);

export const searchFilesPatternFixed = async ({ pattern }) => {
  try {
    const results = [];
    const walk = async (dir) => {
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.name === '.git' || file.name === 'node_modules') continue;
        const res = path.join(dir, file.name);
        if (file.isDirectory()) {
          await walk(res);
        } else {
          if (file.name.includes(pattern) || res.includes(pattern)) {
            results.push(res.replace(/^\.\//, ''));
          }
        }
      }
    };
    await walk('.');
    return JSON.stringify(results.slice(0, 10));
  } catch (e) {
    return `ERR: Search error: ${e.message}`;
  }
};

export const searchTextGlobal = async ({ query }) => {
  if (!query || query.trim() === '') return JSON.stringify([]);
  try {
    const rootPath = process.cwd();
    const cmd = `grep -rIn --exclude-dir={'.*',node_modules} -- '${query.replace(/'/g, "'\\''")}' "${rootPath}" | head -n 10`;
    const { stdout } = await execPromise(cmd, { timeout: 80000 });
    if (!stdout) return JSON.stringify([]);
    const parsedResults = stdout.split('\n').filter(line => line).map(line => {
      const parts = line.split(':');
      const filePath = parts[0];
      const lineNum = parseInt(parts[1], 10);
      const text = parts.slice(2).join(':').trim();
      return { file: path.relative(rootPath, filePath), line: lineNum, text: text };
    }).filter(Boolean);
    return JSON.stringify(parsedResults);
  } catch (e) {
    if (e.code === 1) return JSON.stringify([]);
    if (e.stderr) return `ERR: Search error: ${e.stderr}`;
    return `ERR: Search error: ${e.message}`;
  }
};