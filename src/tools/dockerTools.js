import { exec } from "child_process";
import { promisify } from "util";

export class DockerTools {
  #execAsync = promisify(exec);

  async sh({ command }) {
    const dockerCmd = `docker exec -t paser_mini_runtime sh -c "${command}"`;

    try {
      const { stdout, stderr } = await this.#execAsync(dockerCmd);

      if (stderr && !stdout) {
        return stderr;
      }

      return stdout || "Command executed successfully (no output).";
    } catch (error) {
      return `ERR: ${error.message}`;
    }
  }
}
