import JSZip from "jszip";
import fs from "fs/promises";

/** Zip utility tools. */
export default class ZipTools {
  /**
   * List ZIP contents.
   * @param {string} filepath Path to ZIP.
   * @returns {Promise<string>} JSON string of files or error.
   */
  async listContents(filepath) {
    try {
      const data = await fs.readFile(filepath);
      const zip = await JSZip.loadAsync(data);
      const files = Object.keys(zip.files);
      return JSON.stringify({ files });
    } catch (e) {
      return `ERR: Error listing ZIP contents: ${e.message}`;
    }
  }
}