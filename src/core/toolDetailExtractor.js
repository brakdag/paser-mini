import path from "path";

const MAX_DETAIL_LENGTH = 50;

const PATH_KEYS = ["path", "filepath", "file_path", "filePath"];
const TRUNCATED_KEYS = ["command", "message", "user_message"];
const PASSTHROUGH_KEYS = [
  "url", "query", "pattern", "scene", "title", "ids", "action", "newNickname", "filter",
];

const TOOL_DEFAULTS = {
  push: "insight",
  token: "tokens",
  tree: "tree",
  difference: "all",
  remote: "url",
  patch: "git patch",
  run: "sandbox",
  list: "root",
  ls: "root",
};

/**
 * Extracts a human-readable detail string from tool arguments dynamically,
 * avoiding rigid tool-name coupling (Open/Closed Principle).
 * @param {string} toolName - The name of the tool being executed.
 * @param {object} args - The arguments passed to the tool.
 * @returns {string} A descriptive string identifying the target of the tool operation.
 */
function getToolDetail(toolName, args = {}) {
  // 1. Handle structural and multi-argument cases first
  if (args.origin && args.destination) {
    return `${path.basename(args.origin)} -> ${path.basename(args.destination)}`;
  }
  if (args.issue_number) return `#${args.issue_number}`;
  
  if (toolName === "index") {
    return `${args.path || "root"}${args.filter ? ` (${args.filter})` : ""}`;
  }
  if (toolName === "fetch" && args.url) {
    return args.searchQuery ? `${args.url} (q: ${args.searchQuery})` : args.url;
  }

  // 2. Dynamic argument inspection
  const match = Object.entries(args).find(([key, value]) => {
    if (value === undefined || value === null) return false;
    return PATH_KEYS.includes(key) || TRUNCATED_KEYS.includes(key) || key === "json_string" || PASSTHROUGH_KEYS.includes(key);
  });

  if (match) {
    const [key, value] = match;
    if (PATH_KEYS.includes(key)) {
      const base = path.basename(String(value));
      return toolName === "doc" ? `Docs: ${base}` : base;
    }
    if (TRUNCATED_KEYS.includes(key)) {
      return String(value).substring(0, MAX_DETAIL_LENGTH);
    }
    if (key === "json_string") return `len: ${String(value).length}`;
    if (PASSTHROUGH_KEYS.includes(key)) {
      return String(value);
    }
  }

  // 3. Fallback to static defaults or generic message
  return TOOL_DEFAULTS[toolName] || "no details";
}

export default getToolDetail;
