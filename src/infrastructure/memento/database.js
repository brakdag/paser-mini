import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class MementoDB {
  constructor(dbPath = null) {
    if (!dbPath) {
      const baseDir = process.cwd();
      dbPath = path.join(baseDir, 'config', 'paser_memory.db');
    }

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.dbPath = dbPath;
    this.db = new Database(this.dbPath);
    this.initDb();
  }

  initDb() {
    this.db.pragma('journal_mode = WAL');

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        role TEXT,
        type TEXT CHECK(type IN ('tattoo', 'snapshot', 'fractal')),
        content TEXT NOT NULL,
        teaser TEXT,
        weight INTEGER DEFAULT 0,
        is_vital BOOLEAN DEFAULT 0
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS edges (
        source_id INTEGER,
        target_id INTEGER,
        relation_type TEXT CHECK(relation_type IN ('parent', 'child', 'associative')),
        FOREIGN KEY(source_id) REFERENCES nodes(id),
        FOREIGN KEY(target_id) REFERENCES nodes(id)
      )
    `).run();

    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_nodes_timestamp ON nodes(timestamp)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_nodes_is_vital ON nodes(is_vital)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_nodes_role ON nodes(role)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)').run();
  }

  pushNode(role, nodeType, content, teaser, isVital = false) {
    const stmt = this.db.prepare(
      'INSERT INTO nodes (timestamp, role, type, content, teaser, is_vital) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const info = stmt.run(Math.floor(Date.now() / 1000), role, nodeType, content, teaser, isVital ? 1 : 0);
    return info.lastInsertRowid;
  }

  pullNode(nodeId) {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    return stmt.get(nodeId);
  }

  addEdge(sourceId, targetId, relationType) {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO edges (source_id, target_id, relation_type) VALUES (?, ?, ?)'
    );
    stmt.run(sourceId, targetId, relationType);
  }

  incrementWeight(nodeId) {
    const stmt = this.db.prepare('UPDATE nodes SET weight = weight + 1 WHERE id = ?');
    stmt.run(nodeId);
  }

  getReferencedBy(nodeId) {
    const stmt = this.db.prepare(`
      SELECT n.id, n.timestamp FROM nodes n 
      JOIN edges e ON n.id = e.source_id 
      WHERE e.target_id = ?
    `);
    return stmt.all(nodeId);
  }

  getMirror() {
    const tattoos = this.db.prepare('SELECT * FROM nodes WHERE is_vital = 1 ORDER BY timestamp ASC').all();
    const root = this.db.prepare(
      "SELECT * FROM nodes WHERE type = 'fractal' AND (content = 'Root' OR teaser = 'Root' OR teaser LIKE 'Root%') ORDER BY timestamp DESC LIMIT 1"
    ).get();

    return {
      tattoos,
      root
    };
  }

  getLatestBridge() {
    return this.db.prepare("SELECT * FROM nodes WHERE teaser LIKE 'BRIDGE:%' ORDER BY timestamp DESC LIMIT 1").get();
  }

  getNarrativeNeighbor(currentId, direction) {
    let query = '';
    if (direction === 'next') {
      query = 'SELECT id, teaser, timestamp FROM nodes WHERE id > ? ORDER BY id ASC LIMIT 1';
    } else if (direction === 'prev') {
      query = 'SELECT id, teaser, timestamp FROM nodes WHERE id < ? ORDER BY id DESC LIMIT 1';
    } else {
      return null;
    }
    return this.db.prepare(query).get(currentId);
  }

  getChildren(nodeId) {
    const stmt = this.db.prepare(`
      SELECT n.id, n.teaser FROM nodes n 
      JOIN edges e ON n.id = e.target_id 
      WHERE e.source_id = ? AND e.relation_type = 'child'
    `);
    return stmt.all(nodeId);
  }

  getParent(nodeId) {
    const stmt = this.db.prepare(`
      SELECT n.id, n.teaser FROM nodes n 
      JOIN edges e ON n.id = e.target_id 
      WHERE e.source_id = ? AND e.relation_type = 'parent' LIMIT 1
    `);
    return stmt.get(nodeId);
  }

  searchByTeaser(teaser) {
    return this.db.prepare('SELECT * FROM nodes WHERE teaser = ? LIMIT 1').get(teaser);
  }
}