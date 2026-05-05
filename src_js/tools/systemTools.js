import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export const analyze_pyright = async ({ path: targetPath = '.' }) => {
  try {
    let pyrightPath = path.join(process.cwd(), 'venv', 'bin', 'pyright');
    if (!fs.existsSync(pyrightPath)) {
      pyrightPath = 'pyright';
    }

    const { stdout } = await execPromise(`${pyrightPath} --outputjson ${targetPath}`, { timeout: 60000 });
    
    if (stdout.trim() === '') {
      return 'No se encontraron errores de tipo.';
    }
    return stdout;
  } catch (e) {
    // Pyright devuelve código no cero si encuentra errores, lo cual es el comportamiento esperado
    if (e.stdout) return e.stdout;
    return `ERR: Pyright error: ${e.message}`;
  }
};