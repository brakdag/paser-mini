import fs from 'fs/promises';
import * as acorn from 'acorn';

/**
 * Provides utilities for analyzing JavaScript Abstract Syntax Trees (AST).
 */
export class AstTools {
  /**
   * Simplifies an AST node into a minimal representation.
   * @param {unknown} node - The AST node to simplify.
   * @returns {unknown} The simplified node object.
   */
  simplifyNode(node) {
    const simplified = { type: node.type };
    if (node.type === 'Identifier') simplified.name = node.name;
    if (node.type === 'Literal') simplified.value = node.value;
    if (node.type === 'CallExpression') {
      simplified.callee = node.callee.name || (node.callee.property ? node.callee.property.name : 'complex');
    }
    if (node.type === 'VariableDeclarator') simplified.id = node.id.name;
    if (node.type === 'FunctionDeclaration') simplified.id = node.id ? node.id.name : 'anonymous';
    return simplified;
  }

  /**
   * Recursively walks the AST to find nodes matching the query.
   * @param {unknown} node - The current node being visited.
   * @param {string} query - The node type to search for.
   * @param {Array<unknown>} results - The accumulator for found nodes.
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
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach((item) => {
            if (item && typeof item === 'object') {
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
   * Analyzes a file's AST or tokens based on the provided query.
   * @param {object} options - Analysis options.
   * @param {string} options.path - Path to the source file.
   * @param {string} options.query - The AST node type to search for.
   * @param {number} [options.limit] - Maximum results to return.
   * @returns {Promise<string>} JSON string containing the analysis results.
   */
  async analyze({ path: filePath, query, limit = 100 }) {
    try {
      const code = await fs.readFile(filePath, 'utf8');
      if (!query) return "ERR: Query parameter is required.";
      const results = [];
      if (query === 'Identifier' || query === 'Literal') {
        try {
          const tokenizer = acorn.tokenizer(code, { ecmaVersion: 'latest', sourceType: 'module' });
          let token = tokenizer.getToken();
          while (token.type.label !== 'eof') {
            if (results.length >= limit) break;
            if (query === 'Identifier' && token.type.label === 'name') {
              results.push({ type: 'Identifier', name: token.value });
            } else if (query === 'Literal' && ['num', 'string', 'regexp', 'true', 'false', 'null'].includes(token.type.label)) {
              results.push({ type: 'Literal', value: token.value });
            }
            token = tokenizer.getToken();
          }
          return JSON.stringify({ count: results.length, limit, strategy: "tokenizer_fast_path", results }, null, 2);
        } catch { /* Fallback to AST */ }
      }
      const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
      this.walk(ast, query, results, limit);
      return JSON.stringify({ count: results.length, limit, strategy: "ast_slow_path", results }, null, 2);
    } catch (e) {
      return `ERR: AST Analysis failed: ${e.message}`;
    }
  }
}

export default AstTools;