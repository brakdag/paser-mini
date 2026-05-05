import json
import os

def update_manifest():
    manifest_path = '.migration/manifest.json'
    if not os.path.exists(manifest_path):
        return

    with open(manifest_path, 'r') as f:
        manifest = json.load(f)

    for path, data in manifest['components'].items():
        data['target'] = data['target'].replace('src_ts/', 'src_js/').replace('.ts', '.js')

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

if __name__ == '__main__':
    update_manifest()