import re
import json

def prepare_message_parts(message: str) -> list:
    return [{"text": message}]

def get_available_models(client) -> list:
    return ["gemini-2.0-flash", "gemini-1.5-flash"]

def estimate_tokens(contents) -> int:
    return len(str(contents)) // 4

def count_tokens(client, model, contents) -> int:
    return estimate_tokens(contents)