import shutil
import sys

src = sys.argv[1]
dst = sys.argv[2]

try:
    shutil.move(src, dst)
    print(f'Moved {src} to {dst}')
except Exception as e:
    print(f'Error: {e}')