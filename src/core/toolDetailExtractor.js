import path from "path";

const MONITORING_DETAIL_MAX_LENGTH = 50;
const MONITORING_MESSAGE_MAX_LENGTH = 30;

/**
 * Extracts a human-readable detail string from tool arguments for monitoring purposes.
 * @param {string} toolName - The name of the tool being executed.
 * @param {object} args - The arguments passed to the tool.
 * @returns {string} A descriptive string identifying the target of the tool operation.
 */
function getToolDetail(toolName, args) {
  switch (toolName) {
    case "read":
    case "tail":
    case "write":
    case "remove":
    case "sed":
    case "replace":
    case "analysis":
    case "eslint":
    case "diff":
    case "img":
      return args.path ? path.basename(args.path) : "unknown";
    case "restore":
      return args.filepath ? path.basename(args.filepath) : "unknown";
    case "ls":
    case "list":
      return args.path || "root";
    case "rename":
    case "copy":
      return args.origin && args.destination ? `${path.basename(args.origin)} -> ${path.basename(args.destination)}` : "unknown";
    case "concat":
      return args.destination ? path.basename(args.destination) : "unknown";
    case "doc":
      return args.path ? `Docs: ${path.basename(args.path)}` : "unknown";
    case "execute":
      return args.command ? args.command.substring(0, MONITORING_DETAIL_MAX_LENGTH) : "bash";
    case "grep":
    case "search":
      return args.query || "search";
    case "glob":
      return args.pattern || "pattern";
    case "validate":
      return args.json_string ? `len: ${args.json_string.length}` : "json";
    case "nickname":
      return args.newNickname || "nickname";
    case "push":
      return "insight";
    case "token":
      return "tokens";
    case "tree":
      return "tree";
    case "difference":
      return "all";
    case "remote":
      return "url";
    case "patch":
      return "git patch";
    case "structure":
    case "node":
    case "arrange":
    case "update":
      return args.file_path ? path.basename(args.file_path) : "unknown";
    case "create":
      return args.title || "issue";
    case "edit":
    case "close":
    case "post":
      return args.issue_number ? `#${args.issue_number}` : "issue";
    case "notify":
      return args.message ? args.message.substring(0, MONITORING_MESSAGE_MAX_LENGTH) : "notify";
    case "scene":
      return args.scene || "scene";
    case "jszip":
    case "bin":
      return args.filePath ? path.basename(args.filePath) : "unknown";
    case "url":
      return args.url || "url";
    case "fetch":
      return args.searchQuery ? `${args.url} (q: ${args.searchQuery})` : args.url || "url";
    case "run":
      return "sandbox";
    case "reset":
      return args.user_message ? args.user_message.substring(0, MONITORING_MESSAGE_MAX_LENGTH) : "reset";
    case "index":
      return `${args.path || "root"}${args.filter ? ` (${args.filter})` : ""}`;
    case "load":
      return args.ids || "ids";
    case "real":
      return args.action || "action";
    case "inspect":
      if (args.path) return path.basename(args.path);
      if (args.command) return args.command.substring(0, MONITORING_DETAIL_MAX_LENGTH);
      return "inspect";
    default:
      return "no details";
  }
}

export default getToolDetail;
