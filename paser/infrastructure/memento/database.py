import sqlite3
import time
import os
from typing import List, Optional, Tuple, Dict, Any

class MementoDB:
    """
    Implementation of the Cognitive Graph using SQLite.
    Adheres to the Memento Implementation Plan.
    """
    def __init__(self, db_path: str = None):
        if db_path is None:
            # Resolve absolute path relative to this file
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            db_path = os.path.join(base_dir, "paser", "config", "paser_memory.db")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        self.db_path = db_path
        # Persistent connection for the lifetime of the DB instance
        # check_same_thread=False allows the connection to be used across different threads if necessary
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_db()

    def _init_db(self):
        with self._conn:
            cursor = self._conn.cursor()
            # Nodes table: Stores the actual memory blocks
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
            # Edges table: Stores the relationships between nodes
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
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_teaser ON nodes(teaser)")

    def push_node(self, role: str, node_type: str, content: str, teaser: str, is_vital: bool = False) -> int:
        with self._conn:
            cursor = self._conn.cursor()
            cursor.execute(
                "INSERT INTO nodes (timestamp, role, type, content, teaser, is_vital) VALUES (?, ?, ?, ?, ?, ?)",
                (int(time.time()), role, node_type, content, teaser, int(is_vital))
            )
            return cursor.lastrowid or 0

    def pull_node(self, node_id: int) -> Optional[Dict[str, Any]]:
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
        """Returns list of (id, timestamp) that reference this node."""
        cursor = self._conn.cursor()
        cursor.execute(
            """SELECT n.id, n.timestamp FROM nodes n 
               JOIN edges e ON n.id = e.source_id 
               WHERE e.target_id = ?""",
            (node_id,)
        )
        return cursor.fetchall()

    def get_mirror(self) -> Dict[str, Any]:
        """Retrieves Protocol, Vital Tattoos, and Root Summary."""
        cursor = self._conn.cursor()
        # Vital Tattoos
        cursor.execute("SELECT * FROM nodes WHERE is_vital = 1 ORDER BY timestamp ASC")
        tattoos = [dict(row) for row in cursor.fetchall()]
        
        # Root Summary (The most recent L3/Root node)
        cursor.execute("SELECT * FROM nodes WHERE type = 'fractal' AND (content LIKE '%Root%' OR teaser LIKE '%Root%') ORDER BY timestamp DESC LIMIT 1")
        root = cursor.fetchone()
        
        return {
            "tattoos": tattoos,
            "root": dict(root) if root else None
        }

    def get_latest_bridge(self) -> Optional[Dict[str, Any]]:
        """Retrieves the most recent node with 'BRIDGE' in the teaser."""
        cursor = self._conn.cursor()
        cursor.execute("SELECT * FROM nodes WHERE teaser LIKE 'BRIDGE:%' ORDER BY timestamp DESC LIMIT 1")
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_narrative_neighbor(self, current_id: int, direction: str) -> Optional[Dict[str, Any]]:
        """Navigates the Sequential ID Chain."""
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
        cursor = self._conn.cursor()
        cursor.execute(
            """SELECT n.id, n.teaser FROM nodes n 
               JOIN edges e ON n.id = e.target_id 
               WHERE e.source_id = ? AND e.relation_type = 'child'""",
            (node_id,)
        )
        return [dict(row) for row in cursor.fetchall()]

    def get_parent(self, node_id: int) -> Optional[Dict[str, Any]]:
        cursor = self._conn.cursor()
        cursor.execute(
            """SELECT n.id, n.teaser FROM nodes n 
               JOIN edges e ON n.id = e.target_id 
               WHERE e.source_id = ? AND e.relation_type = 'parent' LIMIT 1""",
            (node_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
