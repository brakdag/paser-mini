import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export const search_files_pattern = async ({ pattern }) => {
  try {
    const rootPath = process.cwd();
    // Usamos find con prune para ignorar carpetas ocultas y head para limitar resultados
    const cmd = `find ${rootPath} -path '*/.*' -prune -o -name '${pattern.replace(/'/g, "'\\'")}' -print | head -n 10`;
    
    const { stdout } = await execPromise(cmd, { timeout: 80000 });
    
    const paths = stdout.split('\n').filter(p => p);
    const relativePaths = paths.map(p => path.relative(rootPath, p));
    
    return JSON.stringify(relativePaths);
  } catch (e) {
    if (e.stderr) return `ERR: Search error: ${e.stderr}`;
    return `ERR: Search error: ${e.message}`;
  }
};

export const search_text_global = async ({ query }) => {
  try {
    const rootPath = process.cwd();
    // grep -rIn: recursivo, ignora mayúsculas, muestra número de línea
    const cmd = `grep -rIn --exclude-dir='.*' -- '${query.replace(/'/g, "'\\'")}' ${rootPath} | head -n 10`;
    
    const { stdout } = await execPromise(cmd, { timeout: 80000 });
    
    if (!stdout) return JSON.stringify([]);

    const parsedResults = stdout.split('\n').filter(line => line).map(line => {
      const parts = line.split(':');
      if (parts.length >= 3) {
        const filePath = parts[0];
        const lineNum = parseInt(parts[1], 10);
        const text = parts.slice(2).join(':').trim();
        return {
          file: path.relative(rootPath, filePath),
          line: lineNum,
          text: text
        };
      }
      return null;
    }).filter(Boolean);

    return JSON.stringify(parsedResults);
  } catch (e) {
    // grep devuelve código 1 si no encuentra nada, lo cual no es un error crítico
    if (e.code === 1) return JSON.stringify([]);
    if (e.stderr) return `ERR: Search error: ${e.stderr}`;
    return `ERR: Search error: ${e.message}`;
  }
};