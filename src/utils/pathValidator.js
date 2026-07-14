import path from "path";

/**
 * Centralized utility for resolving and validating file paths within the project root.
 */
export default class PathValidator {
  /**
   * Resolves a path relative to the project root and ensures it does not escape the root.
   * @param {string} inputPath - The path to resolve.
   * @returns {string} The resolved absolute path.
   * @throws {Error} If the path is outside of the project root.
   */
  static getSafePath(inputPath) {
    const resolved = path.resolve(process.cwd(), inputPath);
    if (!resolved.startsWith(process.cwd())) {
      throw new Error("Security Error: Path is outside of project root");
    }
    return resolved;
  }
}
