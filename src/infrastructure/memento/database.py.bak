import aiosqlite
import time
import os
from typing import List, Optional, Tuple, Dict, Any

class MementoDB:
    """
    Implementation of the Cognitive Graph using SQLite.
    Fully asynchronous implementation using aiosqlite.
    """
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(base_dir, "config", "paser_memory.db")
        
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._conn = None

    async def _get_conn(self):
        """Ensures connection is established and returns it."""
        if self._conn is None:
            self._conn = await aiosqlite.connect(self.db_path)
            self._conn.row_factory = aiosqlite.Row
            await self._conn.execute("PRAGMA journal_mode=WAL;")
            await self._init_db()
        return self._conn

    async def _init_db(self):
        conn = await self._get_conn()
        await conn.execute("""
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
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS edges (
                source_id INTEGER,
                target_id INTEGER,
                relation_type TEXT CHECK(relation_type IN ('parent', 'child', 'associative')),
                FOREIGN KEY(source_id) REFERENCES nodes(id),
                FOREIGN KEY(target_id) REFERENCES nodes(id)
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_timestamp ON nodes(timestamp)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_is_vital ON nodes(is_vital)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_role ON nodes(role)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)")
        await conn.commit()

    async def push_node(self, role: str, node_type: str, content: str, teaser: str, is_vital: bool = False) -> int:
        conn = await self._get_conn()
        cursor = await conn.execute(
            "INSERT INTO nodes (timestamp, role, type, content, teaser, is_vital) VALUES (?, ?, ?, ?, ?, ?)",
            (int(time.time()), role, node_type, content, teaser, int(is_vital))
        )
        await conn.commit()
        return cursor.lastrowid or 0

    async def pull_node(self, node_id: int) -> Optional[Dict[str, Any]]:
        conn = await self._get_conn()
        async with conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def add_edge(self, source_id: int, target_id: int, relation_type: str):
        conn = await self._get_conn()
        await conn.execute(
            "INSERT OR IGNORE INTO edges (source_id, target_id, relation_type) VALUES (?, ?, ?)",
            (source_id, target_id, relation_type)
        )
        await conn.commit()

    async def increment_weight(self, node_id: int):
        conn = await self._get_conn()
        await conn.execute("UPDATE nodes SET weight = weight + 1 WHERE id = ?", (node_id,))
        await conn.commit()

    async def get_referenced_by(self, node_id: int) -> List[Tuple[int, int]]:
        conn = await self._get_conn()
        async with conn.execute(
            """SELECT n.id, n.timestamp FROM nodes n 
               JOIN edges e ON n.id = e.source_id 
               WHERE e.target_id = ?""",
            (node_id,)
        ) as cursor:
            return await cursor.fetchall()

    async def get_mirror(self) -> Dict[str, Any]:
        conn = await self._get_conn()
        async with conn.execute("SELECT * FROM nodes WHERE is_vital = 1 ORDER BY timestamp ASC") as cursor:
            tattoos = [dict(row) for row in await cursor.fetchall()]
        
        async with conn.execute("SELECT * FROM nodes WHERE type = 'fractal' AND (content = 'Root' OR teaser = 'Root' OR teaser LIKE 'Root%') ORDER BY timestamp DESC LIMIT 1") as cursor:
            root = await cursor.fetchone()
        
        return {
            "tattoos": tattoos,
            "root": dict(root) if root else None
        }

    async def get_latest_bridge(self) -> Optional[Dict[str, Any]]:
        conn = await self._get_conn()
        async with conn.execute("SELECT * FROM nodes WHERE teaser LIKE 'BRIDGE:%' ORDER BY timestamp DESC LIMIT 1") as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_narrative_neighbor(self, current_id: int, direction: str) -> Optional[Dict[str, Any]]:
        conn = await self._get_conn()
        if direction == "next":
            query = "SELECT id, teaser, timestamp FROM nodes WHERE id > ? ORDER BY id ASC LIMIT 1"
        elif direction == "prev":
            query = "SELECT id, teaser, timestamp FROM nodes WHERE id < ? ORDER BY id DESC LIMIT 1"
        else:
            return None
        
        async with conn.execute(query, (current_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_children(self, node_id: int) -> List[Dict[str, Any]]:
        conn = await self._get_conn()
        async with conn.execute(
            """SELECT n.id, n.teaser FROM nodes n 
               JOIN edges e ON n.id = e.target_id 
               WHERE e.source_id = ? AND e.relation_type = 'child'""",
            (node_id,)
        ) as cursor:
            return [dict(row) for row in await cursor.fetchall()]

    async def get_parent(self, node_id: int) -> Optional[Dict[str, Any]]:
        conn = await self._get_conn()
        async with conn.execute(
            """SELECT n.id, n.teaser FROM nodes n 
               JOIN edges e ON n.id = e.target_id 
               WHERE e.source_id = ? AND e.relation_type = 'parent' LIMIT 1""",
            (node_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None