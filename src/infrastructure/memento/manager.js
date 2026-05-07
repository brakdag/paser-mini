import { MementoDB } from './database.js';

export class MementoManager {
  static PHI = 1.61803398875;
  static TWEET_SIZE = 280;

  static SCALE_LIMITS = {
    'L0': 280,
    'L1': Math.floor(Math.pow(280, 1.618)),
    'L2': Math.floor(Math.pow(280, 1.618) * 1.618),
    'L3': Math.floor(Math.pow(280, 1.618) * Math.pow(1.618, 2))
  };

  constructor(dbPath = null) {
    this.db = new MementoDB(dbPath);
  }

  _validatePhiScale(content, level) {
    const size = Buffer.byteLength(content, 'utf8');
    const limit = MementoManager.SCALE_LIMITS[level] || Infinity;
    return size <= limit;
  }

  _determineLevel(content) {
    const size = Buffer.byteLength(content, 'utf8');
    if (size <= MementoManager.SCALE_LIMITS['L0']) return 'L0';
    if (size <= MementoManager.SCALE_LIMITS['L1']) return 'L1';
    if (size <= MementoManager.SCALE_LIMITS['L2']) return 'L2';
    return 'L3';
  }

  _parseCitations(text) {
    const pattern = /\[#(\d+),\s*\d{4}-\d{2}-\d{2}.*?\]/g;
    const citations = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      citations.push(parseInt(match[1], 10));
    }
    return citations;
  }

  async pushMemory(role, scope, value, key = null, pointers = []) {
    const level = this._determineLevel(value);
    let finalValue = value;

    if (!this._validatePhiScale(value, level)) {
      const limit = MementoManager.SCALE_LIMITS['L3'];
      finalValue = value.substring(0, limit) + '... [TRUNCATED FOR PHI-COMPLIANCE]';
    }

    const teaser = key || (finalValue.substring(0, 280).replace(/\n/g, ' ') + (finalValue.length > 280 ? '...' : ''));
    const isVital = (scope === 'tattoo');
    const nodeType = isVital ? 'tattoo' : 'fractal';

    const nodeId = this.db.pushNode(role, nodeType, finalValue, teaser, isVital);

    const citations = this._parseCitations(finalValue);
    const allLinks = new Set([...citations, ...pointers]);

    for (const targetId of allLinks) {
      this.db.incrementWeight(targetId);
      this.db.addEdge(nodeId, targetId, 'associative');
    }

    return `Memory stored as node #${nodeId} (${level})`;
  }

  async pullMemory(scope = null, key = null, direction = null) {
    // The Mirror Effect
    if (!scope && !key && !direction) {
      const mirror = this.db.getMirror();
      let res = '--- THE MIRROR ---\n\n';
      res += '[VITAL TATTOOS]\n';
      mirror.tattoos.forEach(t => {
        res += `#${t.id} | ${t.content}\n`;
      });

      if (mirror.root) {
        res += `\n[ROOT SUMMARY]\n#${mirror.root.id} | ${mirror.root.content}\n`;
      } else {
        res += '\n[ROOT SUMMARY] Not found.\n';
      }
      return res;
    }

    // Narrative & Structural Navigation
    if (direction) {
      if (!key) return 'ERR: Please provide the current node ID in \'key\' for navigation.';
      
      const kid = parseInt(key, 10);
      if (isNaN(kid)) return 'ERR: Key must be a numeric node ID for navigation.';

      if (direction === 'up') {
        const parent = this.db.getParent(kid);
        return parent ? `Parent node: #${parent.id} | Teaser: ${parent.teaser}` : 'No parent node found.';
      } else if (direction === 'down') {
        const children = this.db.getChildren(kid);
        if (!children.length) return 'No child nodes found.';
        return 'Children nodes:\n' + children.map(c => `#${c.id} | ${c.teaser}`).join('\n');
      }

      const neighbor = this.db.getNarrativeNeighbor(kid, direction);
      if (!neighbor) return `No more nodes in direction ${direction}.`;
      return `Next node: #${neighbor.id} | Teaser: ${neighbor.teaser} | Date: ${neighbor.timestamp}`;
    }

    // Specific Node Retrieval
    if (key) {
      let node;
      const nodeId = parseInt(key, 10);
      if (!isNaN(nodeId)) {
        node = this.db.pullNode(nodeId);
      } else {
        node = this.db.searchByTeaser(key);
      }

      if (!node) return 'ERR: Node not found.';

      let res = `--- NODE #${node.id} (${node.type}) ---\n`;
      res += `Role: ${node.role} | Weight: ${node.weight}\n`;
      res += `Content: ${node.content}\n\n`;

      const refs = this.db.getReferencedBy(node.id);
      if (refs.length) {
        res += 'Referenced by: ' + refs.map(r => `[#${r.id}, ${r.timestamp}]`).join(', ');
      } else {
        res += 'Referenced by: None';
      }
      return res;
    }

    return 'ERR: Invalid pullMemory arguments.';
  }

  getLatestBridge() {
    return this.db.getLatestBridge();
  }
}