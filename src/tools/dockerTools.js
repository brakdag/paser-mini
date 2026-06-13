import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

class DockerTools {
  async sh({ command }) {
    const dockerCmd = `docker exec -t paser_mini_runtime sh -c "${command}"`;
    try {
      const { stdout, stderr } = await execAsync(dockerCmd);
      return stderr && !stdout ? stderr : (stdout || "Command executed successfully (no output).");
    } catch (error) { return `ERR: ${error.message}`; }
  }
}

export default DockerTools;