import JSZip from "jszip";
import fs from "fs/promises";

export default class ZipTools {
  async listContents({ filePath }) {
    try {
      const data = await fs.readFile(filePath);
      const zip = await JSZip.loadAsync(data);
      const files = Object.keys(zip.files);
      return JSON.stringify({ files });
    } catch (e) {
      return `ERR: Error listing ZIP contents: ${e.message}`;
    }
  }
}