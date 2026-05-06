import json
import re
from pathlib import Path
from typing import Any, Dict, List, Union
from . import context, ToolError

def _parse_path(path: str) -> List[Union[str, int]]:
    if path.startswith('$'):
        path = path[1:]
    path = re.sub(r'\[(\d+)\]', r'.\1', path)
    parts = [p for p in path.split('.') if p]
    final_parts = []
    for p in parts:
        if p.isdigit():
            final_parts.append(int(p))
        else:
            final_parts.append(p)
    return final_parts

def _get_by_path(data: Any, path_parts: List[Union[str, int]]) -> Any:
    current = data
    for part in path_parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and isinstance(part, int) and 0 <= part < len(current):
            current = current[part]
        else:
            raise KeyError(f"Path segment '{part}' not found.")
    return current

def _set_by_path(data: Any, path_parts: List[Union[str, int]], value: Any):
    current = data
    for i in range(len(path_parts) - 1):
        part = path_parts[i]
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and isinstance(part, int) and 0 <= part < len(current):
            current = current[part]
        else:
            raise KeyError(f"Path segment '{part}' not found.")
    
    last_part = path_parts[-1]
    if isinstance(current, dict):
        current[last_part] = value
    elif isinstance(current, list) and isinstance(last_part, int):
        current[last_part] = value
    else:
        raise TypeError("Cannot set value at specified path.")

def getJsonStructure(file_path: str, path: str) -> str:
    try:
        safe_path = context.get_safe_path(file_path)
        if not safe_path.is_file():
            raise ToolError('File not found')
        with open(safe_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        parts = _parse_path(path)
        target = _get_by_path(data, parts)
        if isinstance(target, dict):
            res = {"type": "object", "keys": list(target.keys())}
        elif isinstance(target, list):
            res = {"type": "array", "length": len(target), "item_type": str(type(target[0]).__name__) if target else "unknown"}
        else:
            res = {"type": str(type(target).__name__), "value": target}
        return json.dumps(res)
    except KeyError as e:
        raise ToolError(f"Path error: {str(e)}")
    except Exception as e:
        raise ToolError(f"Error: {str(e)}")

def getJsonNode(file_path: str, path: str) -> str:
    try:
        safe_path = context.get_safe_path(file_path)
        if not safe_path.is_file():
            raise ToolError('File not found')
        with open(safe_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        parts = _parse_path(path)
        target = _get_by_path(data, parts)
        return json.dumps(target)
    except KeyError as e:
        raise ToolError(f"Path error: {str(e)}")
    except Exception as e:
        raise ToolError(f"Error: {str(e)}")

def getJsonArrayInfo(file_path: str, path: str) -> str:
    try:
        safe_path = context.get_safe_path(file_path)
        if not safe_path.is_file():
            raise ToolError('File not found')
        with open(safe_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        parts = _parse_path(path)
        target = _get_by_path(data, parts)
        if not isinstance(target, list):
            raise ToolError(f"Path '{path}' does not point to an array.")
        res = {"length": len(target), "item_type": str(type(target[0]).__name__) if target else "unknown"}
        return json.dumps(res)
    except KeyError as e:
        raise ToolError(f"Path error: {str(e)}")
    except Exception as e:
        raise ToolError(f"Error: {str(e)}")

def updateJsonNode(file_path: str, path: str, value: Any) -> str:
    try:
        safe_path = context.get_safe_path(file_path)
        if not safe_path.is_file():
            raise ToolError('File not found')
        with open(safe_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        parts = _parse_path(path)
        _set_by_path(data, parts, value)
        with open(safe_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return 'OK'
    except KeyError as e:
        raise ToolError(f"Path error: {str(e)}")
    except Exception as e:
        raise ToolError(f"Error: {str(e)}")
