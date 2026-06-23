import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

export default class NotificationTools {
  #execPromise = promisify(exec);

  async notifyUser(message) {
    try {
      const rootPath = process.cwd();
      const soundPath = path.join(rootPath, "src/assets/type.wav");

      const cmd = `(aplay "${soundPath}" || afplay "${soundPath}" || play "${soundPath}") &`;

      await this.#execPromise(cmd);

      console.log(`[NOTIFICATION]: ${message}`);
      return "OK";
    } catch (e) {
      console.error(`[NOTIFICATION ERROR]: ${e.message}`);
      return "OK";
    }
  }
}
