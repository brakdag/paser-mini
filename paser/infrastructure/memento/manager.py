import sqlite3
import re
from typing import List, Optional, Dict, Any
from .database import MementoDB

class MementoManager:
    r"""
    High-level orchestrator for the Memento system.
    Handles $\phi$-scale validation, citation parsing, and memory formatting.
    """
    PHI = 1.61803398875
    TWEET_SIZE = 280
    
    # L0: 280B, L1: 280^phi (~7.6KB), L2: L1*phi (~12.3KB), L3: L2*phi (~19.9KB)
    SCALE_LIMITS = {
        'L0': 280,
        'L1': int(280 ** 1.618),
        'L2': int((280 ** 1.618) * 1.618),
        'L3': int((280 ** 1.618) * (1.618 ** 2))
    }

    def __init__(self, db_path: str = "paser/config/paser_memory.db"):
        self.db = MementoDB(db_path)

    def _validate_phi_scale(self, content: str, level: str) -> bool:
        size = len(content.encode('utf-8'))
        limit = self.SCALE_LIMITS.get(level, float('inf'))
        return size <= limit

    def _determine_level(self, content: str) -> str:
        size = len(content.encode('utf-8'))
        if size <= self.SCALE_LIMITS['L0']: return 'L0'
        if size <= self.SCALE_LIMITS['L1']: return 'L1'
        if size <= self.SCALE_LIMITS['L2']: return 'L2'
        if size <= self.SCALE_LIMITS['L3']: return 'L3'
        return 'L3' # Cap at L3, but will trigger validation warning

    def _parse_citations(self, text: str) -> List[int]:
        # Matches [#ID, Date]
        pattern = r'\[#(\d+),\s*\d{4}-\d{2}-\d{2}.*?\]'
        return [int(m) for m in re.findall(pattern, text)]

    def push_memory(self, role: str, scope: str, value: str, key: Optional[str] = None, pointers: Optional[List[int]] = None) -> str:
        # 1. Determine Level and Validate
        level = self._determine_level(value)
        
        if not self._validate_phi_scale(value, level):
            limit = self.SCALE_LIMITS['L3']
            value = value[:limit] + "... [TRUNCATED FOR PHI-COMPLIANCE]"
            level = 'L3'

        # 2. Extract Teaser (Use key if provided, otherwise first 280 chars)
        if key:
            teaser = key
        else:
            teaser = value[:280].replace('\n', ' ') + ('...' if len(value) > 280 else '')

        # 3. Handle Vital Tattoos
        is_vital = (scope == 'tattoo')
        node_type = 'tattoo' if is_vital else 'fractal'

        # 4. Store Node
        node_id = self.db.push_node(role, node_type, value, teaser, is_vital)

        # 5. Process Citations & Pointers
        citations = self._parse_citations(value)
        all_links = set(citations + (pointers or []))
        
        for target_id in all_links:
            self.db.increment_weight(target_id)
            self.db.add_edge(node_id, target_id, 'associative')

        return f"Memory stored as node #{node_id} ({level})"

    def pull_memory(self, scope: Optional[str] = None, key: Optional[str] = None, direction: Optional[str] = None) -> str:
        # The Mirror Effect
        if scope is None and key is None and direction is None:
            mirror = self.db.get_mirror()
            res = "--- THE MIRROR ---\n\n"
            res += "[VITAL TATTOOS]\n"
            for t in mirror['tattoos']:
                res += f"#{t['id']} | {t['content']}\n"
            
            if mirror['root']:
                res += f"\n[ROOT SUMMARY]\n#{mirror['root']['id']} | {mirror['root']['content']}\n"
            else:
                res += "\n[ROOT SUMMARY] Not found.\n"
            return res

        # Narrative & Structural Navigation
        if direction:
            if not key:
                return "ERR: Please provide the current node ID in 'key' for navigation."
            
            try:
                kid = int(key)
            except ValueError:
                return "ERR: Key must be a numeric node ID for navigation."

            if direction == 'up':
                parent = self.db.get_parent(kid)
                return f"Parent node: #{parent['id']} | Teaser: {parent['teaser']}" if parent else "No parent node found."
            elif direction == 'down':
                children = self.db.get_children(kid)
                if not children:
                    return "No child nodes found."
                return "Children nodes:\n" + "\n".join([f"#{c['id']} | {c['teaser']}" for c in children])
            
            # Default to Narrative (next/prev)
            neighbor = self.db.get_narrative_neighbor(kid, direction)
            if not neighbor:
                return f"No more nodes in direction {direction}."
            return f"Next node: #{neighbor['id']} | Teaser: {neighbor['teaser']} | Date: {neighbor['timestamp']}"

        # Specific Node Retrieval
        if key:
            try:
                node_id = int(key)
                node = self.db.pull_node(node_id)
            except ValueError:
                # Search by teaser/key
                with self.db._get_connection() as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM nodes WHERE teaser = ? LIMIT 1", (key,))
                    row = cursor.fetchone()
                    node = dict(row) if row else None

            if not node:
                return "ERR: Node not found."
            
            res = f"--- NODE #{node['id']} ({node['type']}) ---\n"
            res += f"Role: {node['role']} | Weight: {node['weight']}\n"
            res += f"Content: {node['content']}\n\n"
            
            # Referenced by
            refs = self.db.get_referenced_by(node['id'])
            if refs:
                res += "Referenced by: " + ", ".join([f"[#{r[0]}, {r[1]}]" for r in refs])
            else:
                res += "Referenced by: None"
            
            return res

        return "ERR: Invalid pull_memory arguments."

    def get_latest_bridge(self) -> Optional[Dict[str, Any]]:
        """Retrieves the most recent bridge block for session leaps."""
        return self.db.get_latest_bridge()
