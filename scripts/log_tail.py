import os

file_path = 'src/core/logging/src.log'
# Adjust path for run_python execution
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
full_path = os.path.join(root, file_path)

if os.path.exists(full_path):
    with open(full_path, 'rb') as f:
        f.seek(0, os.SEEK_END)
        size = f.tell()
        # Read last 100KB
        f.seek(max(0, size - 102400))
        print(f.read().decode('utf-8', errors='ignore'))
else:
    print('Log file not found')