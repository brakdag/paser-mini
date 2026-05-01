import json

try:
    with open('spelling_report.json', 'r') as f:
        data = json.load(f)
    
    if isinstance(data, dict):
        print('Keys:', list(data.keys()))
    elif isinstance(data, list):
        print('Is a list. Length:', len(data))
        if len(data) > 0:
            print('First item type:', type(data[0]))
            if isinstance(data[0], dict):
                print('First item keys:', list(data[0].keys()))
    else:
        print('Unknown JSON structure type')
except Exception as e:
    print(f'Error: {e}')