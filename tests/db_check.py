import sqlite3
try:
    conn = sqlite3.connect('agent_memory.db')
    cursor = conn.cursor()
    cursor.execute('PRAGMA integrity_check;')
    print(cursor.fetchone()[0])
    conn.close()
except Exception as e:
    print(f'Error: {e}')