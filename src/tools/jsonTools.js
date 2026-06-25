import fs from "fs/promises";
import path from "path";

/**
 * Provides utilities for manipulating JSON files.
 */
export default class JsonTools {
  /**
   * Resolves and validates the input path.
   * @param {string} inputPath - The path to resolve.
   * @returns {string} The resolved absolute path.
   */
  #getSafePath(inputPath) {
    const resolved = path.resolve(process.cwd(), inputPath);
    if (!resolved.startsWith(process.cwd())) {
      throw new Error("Security Error: Path is outside of project root");
    }
    return resolved;
  }

  /**
   * Parses a path string into segments.
   * @param {string} pathStr - The path string to parse.
   * @returns {Array<string|number>} The parsed path segments.
   */
  #parsePath(pathStr) {
    const normalized = pathStr.replace(/[(d+)]/g, ".$1");
    return normalized
      .split(".")
      .filter((p) => p)
      .map((p) => (typeof p === "string" && /\d+/.test(p) ? parseInt(p, 10) : p));
  }

  /**
   * Retrieves a value from a data object by path.
   * @param {unknown} data - The source data object.
   * @param {Array<string|number>} pathParts - The path segments.
   * @returns {unknown} The retrieved value.
   */
  #getByPath(data, pathParts) {
    let current = data;
    for (let i = 0; i < pathParts.length; i += 1) {
      const part = pathParts[i];
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        throw new Error(`Path segment '${part}' not found.`);
      }
    }
    return current;
  }

  /**
   * Sets a value in a data object by path.
   * @param {unknown} data - The source data object.
   * @param {Array<string|number>} pathParts - The path segments.
   * @param {unknown} value - The value to set.
   */
  #setByPath(data, pathParts, value) {
    let current = data;
    for (let i = 0; i < pathParts.length - 1; i += 1) {
      const part = pathParts[i];
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        throw new Error(`Path segment '${part}' not found.`);
      }
    }

    const lastPart = pathParts[pathParts.length - 1];
    if (current && typeof current === "object") {
      current[lastPart] = value;
    } else {
      throw new TypeError("Cannot set value at specified path.");
    }
  }

  /**
   * Gets the structure of a JSON node.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the node.
   * @returns {Promise<string>} JSON string describing the structure.
   */
  async getJsonStructure(filePath, pathStr) {
    try {
      const safePath = this.#getSafePath(filePath);
      const content = await fs.readFile(safePath, "utf8");
      const data = JSON.parse(content);
      const parts = this.#parsePath(pathStr);
      const target = this.#getByPath(data, parts);

      if (Array.isArray(target)) {
        return JSON.stringify({
          type: "array",
          length: target.length,
          itemType: target.length > 0 ? typeof target[0] : "unknown",
        });
      }
      if (target !== null && typeof target === "object") {
        return JSON.stringify({
          type: "object",
          keys: Object.keys(target),
        });
      }
      return JSON.stringify({
        type: typeof target,
        value: target,
      });
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Retrieves a specific JSON node.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the node.
   * @returns {Promise<string>} The node content as a JSON string.
   */
  async getJsonNode(filePath, pathStr) {
    try {
      const safePath = this.#getSafePath(filePath);
      const content = await fs.readFile(safePath, "utf8");
      const data = JSON.parse(content);
      const parts = this.#parsePath(pathStr);
      const target = this.#getByPath(data, parts);
      return JSON.stringify(target, null, 2);
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Gets information about a JSON array.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the array.
   * @returns {Promise<string>} JSON string with array info.
   */
  async getJsonArrayInfo(filePath, pathStr) {
    try {
      const safePath = this.#getSafePath(filePath);
      const content = await fs.readFile(safePath, "utf8");
      const data = JSON.parse(content);
      const parts = this.#parsePath(pathStr);
      const target = this.#getByPath(data, parts);

      if (!Array.isArray(target)) {
        return `ERR: Path '${pathStr}' does not point to an array.`;
      }

      return JSON.stringify({
        length: target.length,
        itemType: target.length > 0 ? typeof target[0] : "unknown",
      });
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Updates a value in a JSON file.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the node.
   * @param {unknown} value - The new value to set.
   * @returns {Promise<string>} "OK" on success, or an error message.
   */
  async updateJsonNode(filePath, pathStr, value) {
    try {
      const safePath = this.#getSafePath(filePath);
      const content = await fs.readFile(safePath, "utf8");
      const data = JSON.parse(content);
      const parts = this.#parsePath(pathStr);
      this.#setByPath(data, parts, value);
      await fs.writeFile(safePath, JSON.stringify(data, null, 2), "utf8");
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }
}