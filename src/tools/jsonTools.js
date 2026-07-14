import fs from "fs/promises";
import PathValidator from "../utils/pathValidator.js";

/**
 * Provides utilities for manipulating JSON files.
 */
export default class JsonTools {
  /**
   * Parses a path string into segments.
   * @param {string} pathStr - The path string to parse.
   * @returns {Array<string|number>} The parsed path segments.
   */
  #parsePath(pathStr) {
    const normalized = pathStr.replace(/\((\d+)\)/g, ".$1");
    return normalized
      .split(".")
      .filter((p) => p)
      .map((p) => (typeof p === "string" && /^\d+$/.test(p) ? parseInt(p, 10) : p));
  }

  /**
   * Loads and parses a JSON file.
   * @param {string} filePath - Path to the JSON file.
   * @returns {Promise<unknown>} The parsed JSON data.
   */
  async #loadJson(filePath) {
    const safePath = PathValidator.getSafePath(filePath);
    const content = await fs.readFile(safePath, "utf8");
    return JSON.parse(content);
  }

  /**
   * Retrieves a value from a data object by path.
   * @param {unknown} data - The source data object.
   * @param {Array<string|number>} pathParts - The path segments.
   * @returns {unknown} The retrieved value.
   * @throws {Error} If a path segment is not found.
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
   * Sets a value in a data object by path immutably.
   * @param {unknown} data - The source data object.
   * @param {Array<string|number>} pathParts - The path segments.
   * @param {unknown} value - The value to set.
   * @returns {unknown} A new object with the value set.
   * @throws {Error} If a path segment is not found.
   */
  #setByPathImmutable(data, pathParts, value) {
    if (pathParts.length === 0) return value;

    const [first, ...rest] = pathParts;
    const cloned = Array.isArray(data) ? [...data] : { ...data };

    if (data && typeof data === "object" && first in data) {
      cloned[first] = this.#setByPathImmutable(data[first], rest, value);
    } else if (pathParts.length === 1) {
      cloned[first] = value;
    } else {
      throw new Error(`Path segment '${first}' not found.`);
    }

    return cloned;
  }

  /**
   * Gets the structure of a JSON node.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the node.
   * @returns {Promise<string>} JSON string describing the structure.
   */
  async getJsonStructure(filePath, pathStr) {
    const data = await this.#loadJson(filePath);
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
  }
  
  /**
   * Retrieves a specific JSON node.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the node.
   * @returns {Promise<string>} The node content as a JSON string.
   */
  async getJsonNode(filePath, pathStr) {
    const data = await this.#loadJson(filePath);
    const parts = this.#parsePath(pathStr);
    const target = this.#getByPath(data, parts);
    return JSON.stringify(target, null, 2);
  }

  /**
   * Gets information about a JSON array.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the array.
   * @returns {Promise<string>} JSON string with array info.
   */
  async getJsonArrayInfo(filePath, pathStr) {
    const data = await this.#loadJson(filePath);
    const parts = this.#parsePath(pathStr);
    const target = this.#getByPath(data, parts);

    if (!Array.isArray(target)) {
      throw new Error(`Path '${pathStr}' does not point to an array.`);
    }

    return JSON.stringify({
      length: target.length,
      itemType: target.length > 0 ? typeof target[0] : "unknown",
      });
  }

  /**
   * Updates a value in a JSON file.
   * @param {string} filePath - Path to the JSON file.
   * @param {string} pathStr - Path to the node.
   * @param {unknown} value - The new value to set.
   * @returns {Promise<void>} Success is implicit.
   */
  async updateJsonNode(filePath, pathStr, value) {
    const data = await this.#loadJson(filePath);
    const parts = this.#parsePath(pathStr);
    const updatedData = this.#setByPathImmutable(data, parts, value);
    const safePath = PathValidator.getSafePath(filePath);
    await fs.writeFile(safePath, JSON.stringify(updatedData, null, 2), "utf8");
  }
}

