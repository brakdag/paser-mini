import fs from "fs/promises";
import * as acorn from "acorn";

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
        simplified.value = node.value;
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
   * Fast path analysis using the tokenizer.
   * @param {string} code - The source code.
   * @param {string} query - The node type to search for.
   * @param {number} limit - Maximum results to return.
   * @returns {object} The analysis results.
   */
  #analyzeWithTokenizer(code, query, limit) {
    const results = [];
    const tokenizer = acorn.tokenizer(code, {
      ecmaVersion: "latest",
      sourceType: "module",
    });
    let token = tokenizer.getToken();

    while (token.type.label !== "eof") {
      if (results.length >= limit) break;
      if (query === "Identifier" && token.type.label === "name") {
        results.push({ type: "Identifier", name: token.value });
      } else if (
        query === "Literal" &&
        ["num", "string", "regexp", "true", "false", "null"].includes(
          token.type.label,
        )
      ) {
        results.push({ type: "Literal", value: token.value });
      }
      token = tokenizer.getToken();
    }

    return {
      count: results.length,
      limit,
      strategy: "tokenizer_fast_path",
      results,
    };
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
   * Analyzes a file's AST or tokens based on the provided query.
   * @param {string} filepath - Path to the source file.
   * @param {string} query - The AST node type to search for.
   * @param {number} [limit] - Maximum results to return.
   * @returns {Promise<string>} JSON string containing the analysis results.
   */
  async analyze(filepath, query, limit = 100) {
    if (!query) {
      throw new Error("Query parameter is required.");
    }

    const code = await fs.readFile(filepath, "utf8");
    let resultsData;

    if (query === "Identifier" || query === "Literal") {
      try {
        resultsData = this.#analyzeWithTokenizer(code, query, limit);
      } catch (error) {
        // Fallback to AST if tokenizer fails due to syntax errors
      }
    }

    if (!resultsData) {
      resultsData = this.#analyzeWithAST(code, query, limit);
    }

    return JSON.stringify(resultsData, null, 2);
  }
}

export default AstTools;