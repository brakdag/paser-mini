import fs from 'fs/promises';
import * as acorn from 'acorn';
import estraverse from 'estraverse';

export class AstTools {
  async analyze({ path: filePath, query }) {
    try {
      const code = await fs.readFile(filePath, 'utf8');
      const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
      
      if (!query) {
        return JSON.stringify(ast, (key, value) => 
          key === 'start' || key === 'end' ? undefined : value
        , 2);
      }

      const results = [];
      estraverse.traverse(ast, {
        enter: (node) => {
          if (node.type === query) {
            results.push(node);
          }
        }
      });

      return JSON.stringify(results, (key, value) => 
        key === 'start' || key === 'end' ? undefined : value
      , 2);
    } catch (e) {
      return `ERR: AST Analysis failed: ${e.message}`;
    }
  }
}