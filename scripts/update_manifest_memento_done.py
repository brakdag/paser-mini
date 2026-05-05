import json
import os

def update():
    path = '.migration/manifest.json'
    with open(path, 'r') as f:
        m = json.load(f)
    
    for file, data in m['components'].items():
        if 'infrastructure/memento/' in file or 'tools/memory_tools.py' in file:
            data['status'] = 'completed'
            data['verified'] = True
            
    with open(path, 'w') as f:
        json.dump(m, f, indent=2)

if __name__ == '__main__':
    update()