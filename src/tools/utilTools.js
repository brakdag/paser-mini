import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ConfigManager from "../core/configManager.js";

const execPromise = promisify(exec);

export class UtilTools {
  async validateJson({ json_string }) {
    try {
      JSON.parse(json_string);
      return "El JSON es valido.";
    } catch (e) {
      return `ERR: JSON invalido: ${e.message}`;
    }
  }

  async setNickname({ newNickname }) {
    try {
      const config = new ConfigManager();
      const oldNickname = config.get("agent_nickname", "paser_mini");
      config.save("agent_nickname", newNickname);
      return `*** ${oldNickname} is now known as ${newNickname}`;
    } catch (e) {
      return `ERR: Failed to update nickname: ${e.message}`;
    }
  }

  async seeImage({ path: imagePath, crop }) {
    if (!imagePath) throw new Error("The 'path' parameter is required.");

    const tempFile = path.join(os.tmpdir(), `seeImage_${Date.now()}.jpg`);

    try {
      let command = `convert "${imagePath}" -background white -alpha remove`;

      if (crop) {
        if (!Array.isArray(crop) || crop.length !== 4) {
          throw new Error("The 'crop' parameter must be an array of 4 integers: [left, top, right, bottom].");
        }
        const [left, top, right, bottom] = crop;
        const width = right - left;
        const height = bottom - top;
        if (width <= 0 || height <= 0) {
          throw new Error("Invalid crop dimensions: right must be > left and bottom must be > top.");
        }
        command += ` -crop ${width}x${height}+${left}+${top} +repage`;
      }

      command += ` -resize 512x512 -colorspace sRGB -quality 75 "${tempFile}"`;

      await execPromise(command);

      const buffer = await fs.readFile(tempFile);
      const base64Data = buffer.toString('base64');
      
      const { stdout: resStdout } = await execPromise(`identify -format "%wx%h" "${tempFile}"`);
      const resolution = resStdout.trim();

      return {
        mime_type: "image/jpeg",
        data: base64Data,
        resolution: resolution
      };
    } catch (error) {
      throw new Error(`Vision Tool Error: ${error.message}`);
    } finally {
      try {
        await fs.unlink(tempFile);
      } catch (e) {
        // Ignore unlink errors
      }
    }
  }
}