import json
import os

def update():
    path = '.migration/manifest.json'
    with open(path, 'r') as f:
        m = json.load(f)
    
    for file, data in m['components'].items():
        if 'src/core/' in file or 'src/infrastructure/' in file:
            data['status'] = 'completed'
            data['verified'] = True
            
    m['global_state']['current_phase'] = 'Phase 3: Expansion of Capabilities'
    
    with open(path, 'w') as f:
        json.dump(m, f, indent=2)

if __name__ == '__main__':
    update()