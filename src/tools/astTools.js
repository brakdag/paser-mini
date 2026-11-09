import fs from "fs/promises";
import * as acorn from "acorn";
import PathValidator from "../utils/pathValidator.js";

/**
 * Provides utilities for analyzing JavaScript Abstract Syntax Trees (AST).
 */
export class AstTools {
  /**
   * Simplifies an AST node into a minimal representation.
   * @param {object} node - The AST node to simplify.
   * @returns {object} The simplified node object.
   */
  simplifyNode(node) {
    const simplified = { type: node.type };
    switch (node.type) {
      case "Identifier":
        simplified.name = node.name;
        break;
      case "Literal":
        // JSON has no bigint or RegExp value; retain their source information.
        if (node.regex) simplified.value = { pattern: node.regex.pattern, flags: node.regex.flags };
        else simplified.value = typeof node.value === "bigint" ? node.value.toString() : node.value;
        break;
      case "CallExpression":
        simplified.callee =
          node.callee.name ||
          (node.callee.property ? node.callee.property.name : "complex");
        break;
      case "VariableDeclarator":
        simplified.id = node.id.name;
        break;
      case "FunctionDeclaration":
        simplified.id = node.id ? node.id.name : "anonymous";
        break;
      default:
        // No additional properties for this type
        break;
    }
    return simplified;
  }

  /**
   * Recursively walks the AST to find nodes matching the query.
   * @param {object} node - The current node being visited.
   * @param {string} query - The node type to search for.
   * @param {Array<object>} results - The accumulator for found nodes.
   * @param {number} limit - The maximum number of results to find.
   */
  walk(node, query, results, limit) {
    if (!node || results.length >= limit) return;

    if (node.type === query) {
      results.push(this.simplifyNode(node));
    }

    if (results.length >= limit) return;

    Object.keys(node).forEach((key) => {
      const child = node[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          child.forEach((item) => {
            if (item && typeof item === "object") {
              this.walk(item, query, results, limit);
            }
          });
        } else {
          this.walk(child, query, results, limit);
        }
      }
    });
  }

  /**
   * Slow path analysis using the full AST parser.
   * @param {string} code - The source code.
   * @param {string} query - The node type to search for.
   * @param {number} limit - Maximum results to return.
   * @returns {object} The analysis results.
   */
  #analyzeWithAST(code, query, limit) {
    const results = [];
    const ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
    });
    this.walk(ast, query, results, limit);
    return { count: results.length, limit, strategy: "ast_slow_path", results };
  }

  /**
   * Parses the complete JavaScript module and returns matching AST nodes.
   * @param {string} filePath - Path to the source file.
   * @param {string} query - The AST node type to search for.
   * @param {number} [limit] - Maximum results to return.
   * @returns {Promise<string>} JSON string containing the analysis results.
   */
  async analyze(filePath, query, limit = 100) {
    if (!query) {
      throw new Error("Query parameter is required.");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
      throw new Error("Limit must be an integer between 1 and 10000.");
    }

    const code = await fs.readFile(PathValidator.getSafePath(filePath), "utf8");
    const resultsData = this.#analyzeWithAST(code, query, limit);

    return JSON.stringify(resultsData, null, 2);
  }
}

export default AstTools;
