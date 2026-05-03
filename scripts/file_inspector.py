import os

file_path = 'tests/repro_memento_race.py'
# Since run_python runs in the script's dir, we need to go up
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
full_path = os.path.join(root, file_path)

if os.path.exists(full_path):
    size = os.path.getsize(full_path)
    print(f'File: {full_path}')
    print(f'Size: {size} bytes')
    with open(full_path, 'rb') as f:
        print(f'Raw content: {f.read()}')
else:
    print('File not found')