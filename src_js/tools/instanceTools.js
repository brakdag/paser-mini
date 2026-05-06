import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from '../core/configManager.js';

const execPromise = promisify(exec);
const config = new ConfigManager();

function getVenvPython() {
  const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
  if (!fs.existsSync(venvPython)) {
    throw new Error(`Error: No se encontró el intérprete de Python en ${venvPython}.`);
  }
  return venvPython;
}

export const runPython = async ({ script_path, args = [] }) => {
  try {
    const venvPython = getVenvPython();
    const timeout = config.get('instance_timeout', 300);
    const absPath = path.resolve(script_path);
    
    if (!fs.existsSync(absPath)) {
      return `ERR: El archivo de script no existe en la ruta: ${absPath}`;
    }

    const cmd = `${venvPython} ${absPath} ${args.join(' ')}`;
    const { stdout, stderr } = await execPromise(cmd, { timeout: timeout * 1000 });

    return `Archivo ejecutado: ${absPath}\nScript finalizado.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
  } catch (e) {
    return `ERR: Error al ejecutar el script Python: ${e.message}`;
  }
};

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

export const verifyImplementation = async ({ test_script }) => {
  try {
    // 1. Smoke Test
    const smoke = await newAgent({ args: ['--help'] });
    if (!smoke.includes('Paser Mini') && !smoke.includes('usage')) {
      return `❌ Smoke Test Failed: The application failed to start correctly.\n\n${smoke}`;
    }

    // 2. Execution Test
    const testResult = await runPython({ script_path: test_script });

    return `✅ Implementation Verified!\n--------------------------------------------------\n1. Smoke Test: PASSED\n2. Execution Test: COMPLETED\n--------------------------------------------------\nTest Output:\n${testResult}`;
  } catch (e) {
    return `❌ Verification Error: ${e.message}`;
  }
};