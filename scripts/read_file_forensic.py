import os

# Get the project root (one level up from scripts/)
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
file_path = os.path.join(root, 'tests/repro_memento_race.py')

print(f'Reading: {file_path}')
try:
    with open(file_path, 'r') as f:
        print(f.read())
except Exception as e:
    print(f'Error: {e}')