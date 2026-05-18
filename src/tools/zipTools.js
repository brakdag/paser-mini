import JSZip from "jszip";
import fs from "fs/promises";

export class ZipTools {
  #activeZips = new Map();

  async loadZip({ filePath }) {
    try {
      const data = await fs.readFile(filePath);
      const zip = await JSZip.loadAsync(data);
      const zipId = `zip_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      this.#activeZips.set(zipId, zip);
      return JSON.stringify({
        zipId,
        message: `Contenedor cargado exitosamente desde ${filePath}`,
      });
    } catch (e) {
      return `ERR: Error cargando ZIP: ${e.message}`;
    }
  }

  async readZipFile({ zipId, internalPath }) {
    try {
      const zip = this.#activeZips.get(zipId);
      if (!zip) return "ERR: No se encontró un contenedor activo con ese zipId";

      const file = zip.file(internalPath);
      if (!file) return "ERR: File does not exist within the container";

      const content = await file.async("string");
      return JSON.stringify({ internalPath, content });
    } catch (e) {
      return `ERR: Error reading internal file: ${e.message}`;
    }
  }

  async writeZipFile({ zipId, internalPath, content }) {
    try {
      const zip = this.#activeZips.get(zipId);
      if (!zip) return "ERR: No se encontró un contenedor activo con ese zipId";

      zip.file(internalPath, content);
      return JSON.stringify({
        internalPath,
        message: "Archivo actualizado en RAM",
      });
    } catch (e) {
      return `ERR: Error writing internal file: ${e.message}`;
    }
  }

  async saveZip({ zipId, outputPath }) {
    try {
      const zip = this.#activeZips.get(zipId);
      if (!zip) return "ERR: No se encontró un contenedor activo con ese zipId";

      const content = await zip.generateAsync({ type: "nodebuffer" });
      await fs.writeFile(outputPath, content);

      this.#activeZips.delete(zipId);

      return JSON.stringify({
        outputPath,
        message: "Contenedor guardado exitosamente en disco",
      });
    } catch (e) {
      return `ERR: Error guardando ZIP: ${e.message}`;
    }
  }

  async listZipFiles({ zipId }) {
    try {
      const zip = this.#activeZips.get(zipId);
      if (!zip) return "ERR: No se encontró un contenedor activo con ese zipId";

      const files = Object.keys(zip.files);
      return JSON.stringify({ files });
    } catch (e) {
      return `ERR: Error listing files: ${e.message}`;
    }
  }
}
