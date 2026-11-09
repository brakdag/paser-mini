import SCHEMAS, { BINARY_FIELDS } from "../core/schemas.js";

/**
 * Adapts the public flat binary signature to the implementation options object.
 * @param {unknown[]} args - Public positional arguments.
 * @returns {unknown[]} Implementation arguments.
 */
function binaryArguments(args) {
  const [action, filePath, offset, length, end, endianness, outputFile, pattern, hexString, type] = args;
  return [action, filePath, offset, length, end, endianness, { outputFile, pattern, hexString, type }];
}

/**
 * Binds the public contract to the implementation without loading tool modules.
 * Parameter order comes from the same shape used for argument validation.
 * @param {string} description - Public tool description.
 * @param {string|null} moduleKey - Tool implementation module, or internal operation.
 * @param {string|null} method - Implementation method.
 * @param {object} schema - Zod argument schema.
 * @param {object} [options] - Ordering, signature adaptation and compatibility.
 * @param {string[]} [options.parameters] - Explicit order for a union schema.
 * @param {((args: unknown[]) => unknown[])|null} [options.adaptArguments] - Implementation signature adapter.
 * @param {Record<string, string>} [options.aliases] - Legacy argument names.
 * @returns {object} Shared tool contract.
 */
function define(description, moduleKey, method, schema, { parameters = Object.keys(schema.shape), adaptArguments = null, aliases = {} } = {}) {
  return Object.freeze({ description, moduleKey, method, schema, parameters: Object.freeze(parameters), adaptArguments,
    aliases: Object.freeze(aliases), requiresBash: moduleKey === "systemTools" && method === "execute" });
}

// Parser, validator, prompt and executable registry all consume these contracts.
const TOOL_DEFINITIONS = {
  read: define("Read file content", "fileTools", "read", SCHEMAS.read),
  tail: define("Read last N lines of a file", "fileTools", "tail", SCHEMAS.tail),
  write: define("Write content to file", "fileTools", "write", SCHEMAS.write),
  remove: define("Remove file", "fileTools", "remove", SCHEMAS.remove),
  sed: define("Regex search and replace in file", "fileTools", "sed", SCHEMAS.sed),
  list: define("List directory", "fileTools", "list", SCHEMAS.list),
  replace: define("Search and replace string", "fileTools", "replace", SCHEMAS.replace),
  analysis: define("Run static analysis for JS/TS codebase", "systemTools", "analyzeCode", SCHEMAS.analysis),
  eslint: define("Run ESLint", "systemTools", "lintCode", SCHEMAS.eslint),
  doc: define("Generate HTML documentation using JSDoc", "systemTools", "generateDocs", SCHEMAS.doc),
  execute: define("Execute a shell command with user permissions", "systemTools", "execute", SCHEMAS.execute),
  grep: define("Search string in path", "searchTools", "searchText", SCHEMAS.grep),
  glob: define("Search files by pattern", "searchTools", "searchFilesPatternFixed", SCHEMAS.glob),
  rename: define("Move or rename path", "fileTools", "rename", SCHEMAS.rename),
  copy: define("Copy file", "fileTools", "copy", SCHEMAS.copy),
  validate: define("Validates if a string is a valid JSON", "utilTools", "validateJson", SCHEMAS.validate),
  nickname: define("Changes nickname", "utilTools", "setNickname", SCHEMAS.nickname),
  push: define(
    "Store distilled insight in memento.log; cite #ID in content to increase an existing memory's rank.",
    "memoryTools", "pushMemory",
    SCHEMAS.push,
  ),
  token: define("Estimated token usage (character-based heuristic)", "memoryTools", "getTokenCount", SCHEMAS.token),
  tree: define("Get the repository file tree", "gitTools", "getTrackedFiles", SCHEMAS.tree),
  diff: define("Show differences of a file using git diff", "gitTools", "gitDiffAll", SCHEMAS.diff),
  restore: define("Restore a file using git restore", "gitTools", "restoreFile", SCHEMAS.restore, { aliases: { filepath: "path" } }),
  concat: define("Concatenates source file to destination file", "fileTools", "concat", SCHEMAS.concat),
  structure: define("Returns keys and structure of a JSON node", "jsonTools", "getJsonStructure", SCHEMAS.structure, { aliases: { file_path: "filePath", path: "nodePath" } }),
  node: define("Retrieves content of a specific JSON node", "jsonTools", "getJsonNode", SCHEMAS.node, { aliases: { file_path: "filePath", path: "nodePath" } }),
  arrange: define("Returns length and item type of a JSON array", "jsonTools", "getJsonArrayInfo", SCHEMAS.arrange, { aliases: { file_path: "filePath", path: "nodePath" } }),
  update: define("Updates a specific JSON node", "jsonTools", "updateJsonNode", SCHEMAS.update, { aliases: { file_path: "filePath", path: "nodePath" } }),
  issues: define("List issues in GitHub", "githubTools", "listIssues", SCHEMAS.issues),
  create: define("Create a new GitHub issue", "githubTools", "createIssue", SCHEMAS.create),
  edit: define("Edit an existing issue", "githubTools", "editIssue", SCHEMAS.edit),
  close: define("Close an issue", "githubTools", "closeIssue", SCHEMAS.close),
  post: define("Post a comment to a GitHub issue", "githubTools", "postComment", SCHEMAS.post),
  remote: define("Get the current Git repository name", "gitTools", "getCurrentRepo", SCHEMAS.remote),
  patch: define("Apply a git patch", "gitTools", "applyPatch", SCHEMAS.patch),
  notify: define("Start an asynchronous sound notification", "notificationTools", "notifyUser", SCHEMAS.notify),
  scene: define("Insert a Fountain scene", "fountainTools", "insertSceneFountain", SCHEMAS.scene),
  zip: define("Lists all files in a ZIP archive", "zipTools", "listContents", SCHEMAS.zip, { aliases: { filePath: "path" } }),
  bin: define("Perform binary analysis on a file", "binaryTools", "handleHexCommand", SCHEMAS.bin, {
    parameters: Object.keys(BINARY_FIELDS), adaptArguments: binaryArguments, aliases: { filePath: "path" },
  }),
  search: define(
    "Search the web using DuckDuckGo with Brave fallback; use for general queries and URLs.",
    "webTools", "searchWeb",
    SCHEMAS.search,
  ),
  url: define("Render webpage using elinks or PDF content as text via pdftotext", "webTools", "renderWeb", SCHEMAS.url),
  fetch: define(
    "Fetch text or JSON from a URL; searchQuery matches a literal phrase within the fetched content.",
    "webTools", "fetchRaw",
    SCHEMAS.fetch,
  ),
  run: define("Execute JavaScript with user permissions; not a security sandbox", "evalTools", "executeJS", SCHEMAS.run),
  img: define("Visualizes an image.", "utilTools", "seeImage", SCHEMAS.img),
  inspect: define("Debug NodeJS code using built-in inspect repl", "inspectTools", "inspect", SCHEMAS.inspect),
  ast: define("Analyze JavaScript AST", "astTools", "analyze", SCHEMAS.ast),
  metrics: define("Get current process memory and CPU usage", "perfTools", "metrics", SCHEMAS.metrics),
  snapshot: define("Create a V8 heap snapshot", "perfTools", "snapshot", SCHEMAS.snapshot),
  reset: define("Resets the conversation context", "systemTools", "reset", SCHEMAS.reset),
  index: define("Index up to 1000 files/512 KiB of JSON, respecting nested .gitignore and excluding internal metadata. Reports truncation and skipped paths.", "loadTools", "index", SCHEMAS.index),
  load: define("Load up to 50 IDs (e.g. \"0,1,2\") as MIME multipart: 512 KiB total/100 KiB per file. Reports stale/missing files; re-index changes.", "loadTools", "load", SCHEMAS.load),
  qr: define("Render text or URL as a scannable QR code in the terminal", "qrTools", "generateQr", SCHEMAS.qr),
  mkdir: define("Create directory recursively", "fileTools", "mkdir", SCHEMAS.mkdir),
  reloadSchemas: define("Re-register bundled schemas", "systemTools", "reloadSchemas", SCHEMAS.reloadSchemas),
  reloadTools: define("Clear tool instance cache; session contexts must be rebound; does not reload JS", null, null, SCHEMAS.reloadTools),
};

export default Object.freeze(TOOL_DEFINITIONS);
