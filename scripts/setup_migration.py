import os
import json

def setup_migration():
    migration_dir = '.migration'
    if not os.path.exists(migration_dir):
        os.makedirs(migration_dir)

    manifest = {
        'components': {},
        'global_state': {
            'current_phase': 'Phase 1: Analysis & Setup',
            'last_checkpoint': None
        }
    }

    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.py'):
                rel_path = os.path.relpath(os.path.join(root, file), '.')
                # Normalizamos la ruta para usar siempre '/'
                rel_path = rel_path.replace(os.sep, '/')
                target_path = rel_path.replace('.py', '.ts')
                
                manifest['components'][rel_path] = {
                    'status': 'pending',
                    'target': target_path,
                    'dependencies': [],
                    'verified': False
                }

    with open(os.path.join(migration_dir, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)

    with open(os.path.join(migration_dir, 'blueprint.md'), 'w') as f:
        f.write('# Migration Blueprint: Paser Mini (Python -> TypeScript)\n\n## Target Architecture\n- Runtime: Node.js\n- Language: TypeScript\n- Validation: Zod\n- Database: better-sqlite3\n\n## Mapping Rules\n- Python Classes -> TS Classes/Interfaces\n- Python Modules -> TS Modules\n- Snake_case -> camelCase\n')

    with open(os.path.join(migration_dir, 'last_session.log'), 'w') as f:
        f.write('Migration initialized. Manifest created. Blueprint started.')

if __name__ == '__main__':
    setup_migration()