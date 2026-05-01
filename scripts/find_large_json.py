import os

files = [f for f in os.listdir('.') if f.endswith('.json')]
if not files:
    print('No JSON files found')
else:
    file_sizes = [(f, os.path.getsize(f)) for f in files]
    file_sizes.sort(key=lambda x: x[1], reverse=True)
    for f, size in file_sizes:
        print(f'{f} ({size} bytes)')