import json
import os

def update():
    path = '.migration/manifest.json'
    with open(path, 'r') as f:
        m = json.load(f)
    
    # Marcar todo el core y herramientas básicas como completadas
    for file, data in m['components'].items():
        if any(x in file for x in ['src/core/', 'src/infrastructure/', 'src/tools/']):
            data['status'] = 'completed'
            data['verified'] = True
            
    m['global_state']['current_phase'] = 'Phase 3: Expansion (Core Complete)'
    
    with open(path, 'w') as f:
        json.dump(m, f, indent=2)

if __name__ == '__main__':
    update()