import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ConfigManager from "../core/configManager.js";

const execFilePromise = promisify(execFile);

/**
 * Utility tools for system operations and data validation.
 */
export default class UtilTools {
  /**
   * Validates if a string is a valid JSON.
   * @param {string|object} arg1 - The JSON string or an object containing jsonString.
   * @returns {Promise<string>} Validation result message.
   * @throws {Error} If the JSON is invalid.
   */
  async validateJson(arg1) {
    let jsonString = arg1;
    if (typeof arg1 === 'object' && arg1 !== null) {
      jsonString = arg1.jsonString;
    }
    if (!jsonString) {
      throw new Error("Missing required argument: jsonString");
    }
    try {
      JSON.parse(jsonString);
      return "El JSON es valido.";
    } catch (e) {
      throw new Error(`JSON invalido: ${e.message}`);
    }
  }

  /**
   * Updates the agent nickname in the configuration.
   * @param {string} newNickname - The new nickname to be set.
   * @returns {Promise<string>} Confirmation message.
   * @throws {Error} If the update fails.
   */
  async setNickname(newNickname) {
    try {
      const config = new ConfigManager();
      const oldNickname = config.get("agent_nickname", "paser_mini");
      config.save("agent_nickname", newNickname);
      return `*** ${oldNickname} is now known as ${newNickname}`;
    } catch (e) {
      throw new Error(`Failed to update nickname: ${e.message}`);
    }
  }

  /**
   * Processes an image, optionally crops it, and returns it as base64.
   * @param {string} imagePath - The path to the image file.
   * @param {number[]} [crop] - Optional crop coordinates as [left, top, right, bottom].
   * @returns {Promise<{mime_type: string, data: string, resolution: string}>} Image metadata and base64 data.
   * @throws {Error} If the image processing fails.
   */
  async seeImage(imagePath, crop) {
    if (!imagePath) {
    throw new Error("The 'path' parameter is required.");
  }

    const tempFile = path.join(os.tmpdir(), `seeImage_${Date.now()}.jpg`);

    try {
      const args = ["-background", "white", "-alpha", "remove"];

      if (crop) {
        if (!Array.isArray(crop) || crop.length !== 4) {
          throw new Error(
            "The 'crop' parameter must be an array of 4 integers: [left, top, right, bottom].",
          );
        }
        const [left, top, right, bottom] = crop;
        const width = right - left;
        const height = bottom - top;
        if (width <= 0 || height <= 0) {
          throw new Error(
            "Invalid crop dimensions: right must be > left and bottom must be > top.",
          );
        }
        args.push("-crop", `${width}x${height}+${left}+${top}`, "+repage");
      }

      args.push(
        "-resize",
        "512x512",
        "-colorspace",
        "sRGB",
        "-quality",
        "75",
        imagePath,
        tempFile,
      );

      await execFilePromise("convert", args);

      const buffer = await fs.readFile(tempFile);
      const base64Data = buffer.toString("base64");

      const { stdout: resStdout } = await execFilePromise("identify", [
        "-format",
        "%wx%h",
        imagePath,
      ]);
      const resolution = resStdout.trim();

      return {
        mime_type: "image/jpeg",
        data: base64Data,
        resolution,
      };
    } catch (error) {
      throw new Error(`Vision Tool Error: ${error.message}`);
    } finally {
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        // Ignore unlink errors as the temporary file may have already been removed
      }
    }
  }
}