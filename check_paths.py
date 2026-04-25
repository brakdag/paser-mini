import os
print(f'CWD: {os.getcwd()}')
print(f'File exists: {os.path.exists("src/core/smart_parser.py")}')
with open('src/core/smart_parser.py', 'r') as f:
    print(f'First line: {f.readline()}')