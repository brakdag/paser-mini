import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export const notifyUser = async ({ message }) => {
  try {
    const rootPath = process.cwd();
    const soundPath = path.join(rootPath, 'src_js/assets/type.wav');
    
    // Intentamos reproducir el sonido en segundo plano para no bloquear la ejecución.
    // Usamos 'aplay' (Linux) o 'afplay' (macOS) como candidatos comunes.
    // El uso de '&' al final permite que el proceso de sonido corra de forma asíncrona.
    const cmd = `(aplay "${soundPath}" || afplay "${soundPath}" || play "${soundPath}") &`;
    
    await execPromise(cmd);
    
    console.log(`[NOTIFICATION]: ${message}`);
    return "OK";
  } catch (e) {
    // Si falla el sonido, no queremos que falle la notificación en sí.
    console.error(`[NOTIFICATION ERROR]: ${e.message}`);
    return "OK";
  }
};
