import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function sh({ command }) {
  // El comando se ejecuta dentro del contenedor de Docker
  // Usamos -t para asegurar un TTY y que la salida sea limpia
  const dockerCmd = `docker exec -t paser_mini_runtime sh -c "${command}"`;

  try {
    const { stdout, stderr } = await execAsync(dockerCmd);

    if (stderr && !stdout) {
      return stderr;
    }

    return stdout || "Command executed successfully (no output).";
  } catch (error) {
    // Capturamos el error de ejecución de Docker (ej. comando no encontrado o error de shell)
    return `ERR: ${error.message}`;
  }
}

export default {
  sh,
};
