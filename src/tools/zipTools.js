import JSZip from "jszip";
import fs from "fs/promises";

/**
 * Zip utility tools for managing and inspecting compressed archives.
 */
export default class ZipTools {
  /**
   * List the contents of a ZIP archive.
   * @param {string} filepath - Path to the ZIP file.
   * @returns {Promise<string>} JSON string containing the list of files.
   * @throws {Error} If the file cannot be read or is not a valid ZIP archive.
   */
  async listContents(filepath) {
    const data = await fs.readFile(filepath);
    const zip = await JSZip.loadAsync(data);
    const files = Object.keys(zip.files);
    return JSON.stringify({ files });
  }
}
