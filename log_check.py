try:
    with open('paser.log', 'rb') as f:
        f.seek(-10000, 2) # Read last 10KB
        print(f.read().decode('utf-8', errors='ignore'))
except Exception as e:
    print(f'Error: {e}')