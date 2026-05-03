import sqlite3
import time
import os
import asyncio
import threading
from typing import List, Optional, Tuple, Dict, Any

class MementoDB:
    """
    Implementation of the Cognitive Graph using SQLite.
    Optimized with thread-local connection pooling for async environments.
    """
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(base_dir, "config", "paser_memory.db")
        
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._local = threading.local()

    def _get_connection(self) -> sqlite3.Connection:
        """Returns a thread-local connection with WAL mode enabled."""
        if not hasattr(self._local, "connection"):
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            self._local.connection = conn
        return self._local.connection

    def _sync_init_db(self):
        """Synchronous database initialization."""
        conn = self._get_connection()
        with conn:
            conn.execute("""
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
            conn.execute("""
                CREATE TABLE IF NOT EXISTS edges (
                    source_id INTEGER,
                    target_id INTEGER,
                    relation_type TEXT CHECK(relation_type IN ('parent', 'child', 'associative')),
                    FOREIGN KEY(source_id) REFERENCES nodes(id),
                    FOREIGN KEY(target_id) REFERENCES nodes(id)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_timestamp ON nodes(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_is_vital ON nodes(is_vital)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_role ON nodes(role)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)")

    async def ensure_initialized(self):
        """Public async method to ensure DB is ready."""
        await asyncio.to_thread(self._sync_init_db)

    async def push_node(self, role: str, node_type: str, content: str, teaser: str, is_vital: bool = False) -> int:
        return await asyncio.to_thread(self._sync_push_node, role, node_type, content, teaser, is_vital)

    def _sync_push_node(self, role: str, node_type: str, content: str, teaser: str, is_vital: bool) -> int:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute(
                "INSERT INTO nodes (timestamp, role, type, content, teaser, is_vital) VALUES (?, ?, ?, ?, ?, ?)",
                (int(time.time()), role, node_type, content, teaser, int(is_vital))
            )
            return cursor.lastrowid or 0

    async def pull_node(self, node_id: int) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._sync_pull_node, node_id)

    def _sync_pull_node(self, node_id: int) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    async def add_edge(self, source_id: int, target_id: int, relation_type: str):
        await asyncio.to_thread(self._sync_add_edge, source_id, target_id, relation_type)

    def _sync_add_edge(self, source_id: int, target_id: int, relation_type: str):
        conn = self._get_connection()
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO edges (source_id, target_id, relation_type) VALUES (?, ?, ?)",
                (source_id, target_id, relation_type)
            )

    async def increment_weight(self, node_id: int):
        await asyncio.to_thread(self._sync_increment_weight, node_id)

    def _sync_increment_weight(self, node_id: int):
        conn = self._get_connection()
        with conn:
            conn.execute("UPDATE nodes SET weight = weight + 1 WHERE id = ?", (node_id,))

    async def get_referenced_by(self, node_id: int) -> List[Tuple[int, int]]:
        return await asyncio.to_thread(self._sync_get_referenced_by, node_id)

    def _sync_get_referenced_by(self, node_id: int) -> List[Tuple[int, int]]:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute(
                """SELECT n.id, n.timestamp FROM nodes n 
                   JOIN edges e ON n.id = e.source_id 
                   WHERE e.target_id = ?""",
                (node_id,)
            )
            return cursor.fetchall()

    async def get_mirror(self) -> Dict[str, Any]:
        return await asyncio.to_thread(self._sync_get_mirror)

    def _sync_get_mirror(self) -> Dict[str, Any]:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute("SELECT * FROM nodes WHERE is_vital = 1 ORDER BY timestamp ASC")
            tattoos = [dict(row) for row in cursor.fetchall()]
            
            cursor = conn.execute("SELECT * FROM nodes WHERE type = 'fractal' AND (content = 'Root' OR teaser = 'Root' OR teaser LIKE 'Root%') ORDER BY timestamp DESC LIMIT 1")
            root = cursor.fetchone()
            
            return {
                "tattoos": tattoos,
                "root": dict(root) if root else None
            }

    async def get_latest_bridge(self) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._sync_get_latest_bridge)

    def _sync_get_latest_bridge(self) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute("SELECT * FROM nodes WHERE teaser LIKE 'BRIDGE:%' ORDER BY timestamp DESC LIMIT 1")
            row = cursor.fetchone()
            return dict(row) if row else None

    async def get_narrative_neighbor(self, current_id: int, direction: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._sync_get_narrative_neighbor, current_id, direction)

    def _sync_get_narrative_neighbor(self, current_id: int, direction: str) -> Optional[Dict[str, Any]]:
        if direction == "next":
            query = "SELECT id, teaser, timestamp FROM nodes WHERE id > ? ORDER BY id ASC LIMIT 1"
        elif direction == "prev":
            query = "SELECT id, teaser, timestamp FROM nodes WHERE id < ? ORDER BY id DESC LIMIT 1"
        else:
            return None
        
        conn = self._get_connection()
        with conn:
            cursor = conn.execute(query, (current_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    async def get_children(self, node_id: int) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._sync_get_children, node_id)

    def _sync_get_children(self, node_id: int) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute(
                """SELECT n.id, n.teaser FROM nodes n 
                   JOIN edges e ON n.id = e.target_id 
                   WHERE e.source_id = ? AND e.relation_type = 'child'""",
                (node_id,)
            )
            return [dict(row) for row in cursor.fetchall()]

    async def get_parent(self, node_id: int) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._sync_get_parent, node_id)

    def _sync_get_parent(self, node_id: int) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute(
                """SELECT n.id, n.teaser FROM nodes n 
                   JOIN edges e ON n.id = e.target_id 
                   WHERE e.source_id = ? AND e.relation_type = 'parent' LIMIT 1""",
                (node_id,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    async def search_by_teaser(self, teaser: str) -> Optional[Dict[str, Any]]:
        """Search for a node by its teaser string."""
        return await asyncio.to_thread(self._sync_search_by_teaser, teaser)

    def _sync_search_by_teaser(self, teaser: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        with conn:
            cursor = conn.execute("SELECT * FROM nodes WHERE teaser = ? LIMIT 1", (teaser,))
            row = cursor.fetchone()
            return dict(row) if row else None