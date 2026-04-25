import json


class ToolAttemptTracker:
    """Tracks tool calls to detect behavioral loops."""

    def __init__(self, max_exact_attempts=5, max_tool_failures=5):
        self.exact_attempts = {}
        self.tool_failures = {}
        self.max_exact_attempts = max_exact_attempts
        self.max_tool_failures = max_tool_failures

    def record_attempt(self, name, args):
        args_json = json.dumps(args, sort_keys=True)
        key = (name, args_json)
        self.exact_attempts[key] = self.exact_attempts.get(key, 0) + 1
        return self.exact_attempts[key] <= self.max_exact_attempts

    def record_failure(self, name):
        self.tool_failures[name] = self.tool_failures.get(name, 0) + 1
        return self.tool_failures[name] <= self.max_tool_failures

    def record_success(self, name):
        self.tool_failures[name] = 0

    def reset(self):
        self.exact_attempts = {}
        self.tool_failures = {}
