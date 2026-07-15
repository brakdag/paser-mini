import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ConfigManager from "../core/configManager.js";

const execFilePromise = promisify(execFile);
const AGENT_NICKNAME_CONFIG_KEY = "agent_nickname";
const IMAGE_RESIZE_DIMENSION = "512x512";
const IMAGE_QUALITY = "75";

/**
 * Utility tools for system operations and data validation.
 */
export default class UtilTools {
  #model = null;

  /**
   * Injects the shared model identity object.
   * @param {object} model The shared model identity.
   */
  setIdentityContext(model) {
    this.#model = model;
  }

  /**
   * Validates if a string is a valid JSON.
   * @param {string|object} arg1 - The JSON string or an object containing jsonString.
   * @returns {Promise<string>} Validation result message.
   * @throws {Error} If the JSON is invalid.
   */
  async validateJson(arg1) {
    let jsonString = arg1;
    if (typeof arg1 === "object" && arg1 !== null) {
      jsonString = arg1.jsonString;
    }
    if (!jsonString) {
      throw new Error("Missing required argument: jsonString");
    }
    try {
      JSON.parse(jsonString);
      return "The JSON is valid.";
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
  }

  /**
   * Updates the agent nickname globally by mutating the shared identity object.
   * @param {string} newNickname - The new nickname to be set.
   * @returns {Promise<string>} Confirmation message.
   * @throws {Error} If the identity context is not set or update fails.
   */
  async setNickname(newNickname) {
    if (!this.#model) {
      throw new Error("Identity context not initialized in UtilTools.");
    }
    try {
      const oldNickname = this.#model.nickname;
      this.#model.nickname = newNickname; // Instant mutation by reference
      
      const config = new ConfigManager();
      config.save(AGENT_NICKNAME_CONFIG_KEY, newNickname);
      
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
    if (!imagePath) throw new Error("The 'path' parameter is required.");

    const tempFile = path.join(os.tmpdir(), `seeImage_${Date.now()}.jpg`);

    try {
      await this.#processImage(imagePath, tempFile, crop);
      const base64Data = (await fs.readFile(tempFile)).toString("base64");
      const resolution = await this.#getImageResolution(imagePath);

      return {
        mime_type: "image/jpeg",
        data: base64Data,
        resolution,
      };
    } catch (error) {
      throw new Error(`Vision Tool Error: ${error.message}`);
    } finally {
      await this.#cleanupTempFile(tempFile);
    }
  }

  /**
   * Internal method to process image using ImageMagick.
   * @param {string} imagePath - Path to source image.
   * @param {string} tempFile - Path to temporary output file.
   * @param {number[]} [crop] - Optional crop coordinates.
   * @returns {Promise<void>}
   */
  async #processImage(imagePath, tempFile, crop) {
    const args = ["-background", "white", "-alpha", "remove"];

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
      args.push("-crop", `${width}x${height}+${left}+${top}`, "+repage");
    }

    args.push("-resize", IMAGE_RESIZE_DIMENSION, "-colorspace", "sRGB", "-quality", IMAGE_QUALITY, imagePath, tempFile);
    await execFilePromise("convert", args);
  }

  /**
   * Internal method to get image resolution using ImageMagick.
   * @param {string} imagePath - Path to image.
   * @returns {Promise<string>} Resolution string (WxH).
   */
  async #getImageResolution(imagePath) {
    const { stdout } = await execFilePromise("identify", ["-format", "%wx%h", imagePath]);
    return stdout.trim();
  }

  /**
   * Internal method to remove temporary files.
   * @param {string} filePath - Path to file to remove.
   * @returns {Promise<void>}
   */
  async #cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch {
      // Silent failure for cleanup
    }
  }
}