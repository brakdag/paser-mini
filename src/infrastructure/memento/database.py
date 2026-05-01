import sqlite3
import time
import os
from typing import List, Optional, Tuple, Dict, Any

class MementoDB:
    """
    Implementation of the Cognitive Graph using SQLite.
    Adheres to the Memento Implementation Plan.
    """
    def __init__(self, db_path: Optional[str] = None):
        """Inicializa la base de datos y configura la conexión SQLite."""
        if db_path is None:
            # Use the directory where the application is installed (src/config/)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(base_dir, "config", "paser_memory.db")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        self.db_path = db_path
        # Persistent connection for the lifetime of the DB instance
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        # Enable WAL mode for better concurrency
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        """Devuelve la conexión SQLite activa."""
        return self._conn

    def _init_db(self):
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute("""
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
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS edges (
                    source_id INTEGER,
                    target_id INTEGER,
                    relation_type TEXT CHECK(relation_type IN ('parent', 'child', 'associative')),
                    FOREIGN KEY(source_id) REFERENCES nodes(id),
                    FOREIGN KEY(target_id) REFERENCES nodes(id)
                )
            """)
            # Indices for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_timestamp ON nodes(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_is_vital ON nodes(is_vital)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_role ON nodes(role)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)")

    def push_node(self, role: str, node_type: str, content: str, teaser: str, is_vital: bool = False) -> int:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute(
                "INSERT INTO nodes (timestamp, role, type, content, teaser, is_vital) VALUES (?, ?, ?, ?, ?, ?)",
                (int(time.time()), role, node_type, content, teaser, int(is_vital))
            )
            return cursor.lastrowid or 0

    def pull_node(self, node_id: int) -> Optional[Dict[str, Any]]:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute("SELECT * FROM nodes WHERE id = ?", (node_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def add_edge(self, source_id: int, target_id: int, relation_type: str):
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute(
                "INSERT OR IGNORE INTO edges (source_id, target_id, relation_type) VALUES (?, ?, ?)",
                (source_id, target_id, relation_type)
            )

    def increment_weight(self, node_id: int):
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute("UPDATE nodes SET weight = weight + 1 WHERE id = ?", (node_id,))

    def get_referenced_by(self, node_id: int) -> List[Tuple[int, int]]:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute(
                """SELECT n.id, n.timestamp FROM nodes n 
                   JOIN edges e ON n.id = e.source_id 
                   WHERE e.target_id = ?""",
                (node_id,)
            )
            return cursor.fetchall()

    def get_mirror(self) -> Dict[str, Any]:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute("SELECT * FROM nodes WHERE is_vital = 1 ORDER BY timestamp ASC")
            tattoos = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM nodes WHERE type = 'fractal' AND (content = 'Root' OR teaser = 'Root' OR teaser LIKE 'Root%') ORDER BY timestamp DESC LIMIT 1")
            root = cursor.fetchone()
            
            return {
                "tattoos": tattoos,
                "root": dict(root) if root else None
            }

    def get_latest_bridge(self) -> Optional[Dict[str, Any]]:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute("SELECT * FROM nodes WHERE teaser LIKE 'BRIDGE:%' ORDER BY timestamp DESC LIMIT 1")
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_narrative_neighbor(self, current_id: int, direction: str) -> Optional[Dict[str, Any]]:
        with self._conn:
            cursor = self._conn.cursor()
            if direction == "next":
                cursor.execute("SELECT id, teaser, timestamp FROM nodes WHERE id > ? ORDER BY id ASC LIMIT 1", (current_id,))
            elif direction == "prev":
                cursor.execute("SELECT id, teaser, timestamp FROM nodes WHERE id < ? ORDER BY id DESC LIMIT 1", (current_id,))
            else:
                return None
            
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_children(self, node_id: int) -> List[Dict[str, Any]]:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute(
                """SELECT n.id, n.teaser FROM nodes n 
                   JOIN edges e ON n.id = e.target_id 
                   WHERE e.source_id = ? AND e.relation_type = 'child'""",
                (node_id,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_parent(self, node_id: int) -> Optional[Dict[str, Any]]:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute(
                """SELECT n.id, n.teaser FROM nodes n 
                   JOIN edges e ON n.id = e.target_id 
                   WHERE e.source_id = ? AND e.relation_type = 'parent' LIMIT 1""",
                (node_id,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None