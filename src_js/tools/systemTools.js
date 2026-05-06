import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export const analyzeCode = async ({ path: targetPath = '.' }) => {
  try {
    // Usamos npx para asegurar que pyright esté disponible sin depender de una instalación global o venv
    const { stdout } = await execPromise(`npx pyright --outputjson ${targetPath}`, { timeout: 60000 });
    
    if (stdout.trim() === '') {
      return 'No type or syntax errors found.';
    }
    return stdout;
  } catch (e) {
    // Pyright returns a non-zero code if errors are found
    if (e.stdout) return e.stdout;
    return `ERR: Analysis error: ${e.message}`;
  }
};


export const lintCode = async ({ path: targetPath = '.' }) => {
  try {
    // Usamos npx eslint para analizar el código basándonos en el .eslintrc.json
    const { stdout } = await execPromise(`npx eslint ${targetPath} --format json`, { timeout: 60000 });
    
    if (!stdout || stdout.trim() === '[]') {
      return 'No linting issues found.';
    }
    return stdout;
  } catch (e) {
    // ESLint returns a non-zero code if errors are found
    if (e.stdout) return e.stdout;
    return `ERR: Linting error: ${e.message}`;
  }
};


export const generateDocs = async ({ path: targetPath = '.', outputDir = 'docs/api' }) => {
  try {
    // Aseguramos que el directorio de salida exista
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    // Ejecutamos jsdoc vía npx para generar la documentación HTML
    const { stdout } = await execPromise(`npx jsdoc ${targetPath} -d ${outputDir}`, { timeout: 60000 });
    
    return `Documentation successfully generated in: ${outputDir}`;
  } catch (e) {
    return `ERR: Documentation error: ${e.message}`;
  }
};


export const executeBash = async ({ command }) => {
  try {
    // Ejecutamos el comando asegurando que el directorio de trabajo sea la raíz del proyecto
    // Se añade un timeout para evitar procesos colgados
    const { stdout, stderr } = await execPromise(command, {
      cwd: process.cwd(),
      timeout: 60000
    });
    
    return stdout || stderr || 'Command executed successfully (no output).';
  } catch (e) {
    // Capturamos el stdout incluso en caso de error (ej. tests fallidos)
    if (e.stdout) return `Exit Code ${e.code}:\n${e.stdout}\n${e.stderr || ''}`;
    return `ERR: Bash error: ${e.message}`;
  }
};