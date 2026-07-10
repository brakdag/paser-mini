import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_MAP = {
  fileTools: "../tools/fileTools.js",
  systemTools: "../tools/systemTools.js",
  utilTools: "../tools/utilTools.js",
  searchTools: "../tools/searchTools.js",
  memoryTools: "../tools/memoryTools.js",
  jsonTools: "../tools/jsonTools.js",
  githubTools: "../tools/githubTools.js",
  gitTools: "../tools/gitTools.js",
  notificationTools: "../tools/notificationTools.js",
  fountainTools: "../tools/fountainTools.js",
  zipTools: "../tools/zipTools.js",
  binaryTools: "../tools/binaryTools.js",
  webTools: "../tools/webTools.js",
  evalTools: "../tools/evalTools.js",
  astTools: "../tools/astTools.js",
  perfTools: "../tools/perfTools.js",
  inspectTools: "../tools/inspectTools.js",
};

let toolCache = {};

/**
 * Retrieves the singleton instance of a tool based on its module key.
 * @param {string} moduleKey The key of the module to instantiate.
 * @returns {Promise<object>} The instantiated tool object.
 */
export async function getToolInstance(moduleKey) {
  if (!toolCache[moduleKey]) {
    const modulePath = MODULE_MAP[moduleKey];
    if (!modulePath) throw new Error(`Module ${moduleKey} not mapped.`);
    const module = await import(`${modulePath}?update=${Date.now()}`);
    let className = moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
    if (moduleKey === "githubTools") className = "GithubTools";
    const ToolClass = module[className] || module.default;
    if (!ToolClass)
      throw new Error(`Class ${className} not found in ${modulePath}`);
    toolCache[moduleKey] = new ToolClass();
  }
  return toolCache[moduleKey];
}

/**
 * Retrieves a specific function bound to its tool instance.
 * @param {string} moduleKey The key of the module containing the tool.
 * @param {string} funcName The name of the function to retrieve.
 * @returns {Promise<(...args: unknown[]) => unknown>} The requested function bound to the tool instance.
 */
async function getTool(moduleKey, funcName) {
  const instance = await getToolInstance(moduleKey);
  const func = instance[funcName];
  if (!func) throw new Error(`Method ${funcName} not found in ${moduleKey}.`);
  return func.bind(instance);
}

export const GITHUB_SYSTEM_INSTRUCTION =
  "## GitHub Mode Protocol\n" +
  "You are operating in GitHub Mode. Your primary interface is GitHub/Issues.\n" +
  "1. Communication: All via GitHub issue comments.\n" +
  "2. Planning: Post a detailed Work Plan first.\n" +
  "3. Progress: Use Markdown checklists.\n" +
  "4. Transparency: Be explicit about actions.";

export const AVAILABLE_TOOLS = {
  /**
   * Reads file content.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The file content.
   */
  read: async (...args) => (await getTool("fileTools", "read"))(...args),
  /**
   * Reads the last N lines of a file.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The tail content.
   */
  tail: async (...args) => (await getTool("fileTools", "tail"))(...args),
  /**
   * Writes content to a file.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The write result.
   */
  write: async (...args) => (await getTool("fileTools", "write"))(...args),
  /**
   * Removes a file.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The removal result.
   */
  remove: async (...args) => (await getTool("fileTools", "remove"))(...args),
  /**
   * Creates a directory.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The mkdir result.
   */
  mkdir: async (...args) => (await getTool("fileTools", "mkdir"))(...args),
  /**
   * Reloads the schema registry.
   * @param {...unknown} args - Arguments passed to the system tool.
   * @returns {Promise<unknown>} The reload result.
   */
  reloadSchemas: async (...args) =>
    (await getTool("systemTools", "reloadSchemas"))(...args),
  /**
   * Analyzes code structure.
   * @param {...unknown} args - Arguments passed to the system tool.
   * @returns {Promise<unknown>} The analysis result.
   */
  analysis: async (...args) => (await getTool("systemTools", "analyzeCode"))(...args),
  /**
   * Lists directory contents.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The directory listing.
   */
  list: async (...args) => (await getTool("fileTools", "list"))(...args),
  /**
   * Replaces text in a file.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The replace result.
   */
  replace: async (...args) => (await getTool("fileTools", "replace"))(...args),
  /**
   * Performs regex search and replace in a file.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The sed result.
   */
  sed: async (...args) => (await getTool("fileTools", "sed"))(...args),
  /**
   * Runs ESLint on a file.
   * @param {...unknown} args - Arguments passed to the system tool.
   * @returns {Promise<unknown>} The lint result.
   */
  eslint: async (...args) => (await getTool("systemTools", "lintCode"))(...args),
  /**
   * Generates documentation.
   * @param {...unknown} args - Arguments passed to the system tool.
   * @returns {Promise<unknown>} The generated docs.
   */
  doc: async (...args) => (await getTool("systemTools", "generateDocs"))(...args),
  /**
   * Executes a bash command.
   * @param {...unknown} args - Arguments passed to the system tool.
   * @returns {Promise<unknown>} The execution result.
   */
  execute: async (...args) => (await getTool("systemTools", "executeBash"))(...args),
  /**
   * Searches for text in files.
   * @param {...unknown} args - Arguments passed to the search tool.
   * @returns {Promise<unknown>} The search results.
   */
  grep: async (...args) =>
    (await getTool("searchTools", "searchText"))(...args),
  /**
   * Searches for files matching a pattern.
   * @param {...unknown} args - Arguments passed to the search tool.
   * @returns {Promise<unknown>} The matching file paths.
   */
  glob: async (...args) =>
    (await getTool("searchTools", "searchFilesPatternFixed"))(...args),
  /**
   * Renames or moves a file.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The rename result.
   */
  rename: async (...args) => (await getTool("fileTools", "rename"))(...args),
  /**
   * Copies a file.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The copy result.
   */
  copy: async (...args) => (await getTool("fileTools", "copy"))(...args),
  /**
   * Gets git tracked files.
   * @param {...unknown} args - Arguments passed to the git tool.
   * @returns {Promise<unknown>} The tracked files list.
   */
  tree: async (...args) => (await getTool("gitTools", "getTrackedFiles"))(...args),
  /**
   * Validates a JSON string.
   * @param {...unknown} args - Arguments passed to the util tool.
   * @returns {Promise<unknown>} The validation result.
   */
  valide: async (...args) => (await getTool("utilTools", "validateJson"))(...args),
  /**
   * Sets the agent nickname.
   * @param {...unknown} args - Arguments passed to the util tool.
   * @returns {Promise<unknown>} The nickname change result.
   */
  nickname: async (...args) => (await getTool("utilTools", "setNickname"))(...args),
  /**
   * Pushes data to memory.
   * @param {...unknown} args - Arguments passed to the memory tool.
   * @returns {Promise<unknown>} The push result.
   */
  push: async (...args) => (await getTool("memoryTools", "pushMemory"))(...args),
  /**
   * Gets the token count.
   * @param {...unknown} args - Arguments passed to the memory tool.
   * @returns {Promise<unknown>} The token count.
   */
  token: async (...args) => (await getTool("memoryTools", "getTokenCount"))(...args),
  /**
   * Gets the git diff.
   * @param {...unknown} args - Arguments passed to the git tool.
   * @returns {Promise<unknown>} The diff output.
   */
  diff: async (...args) => (await getTool("gitTools", "gitDiffAll"))(...args),
  /**
   * Restores a file via git.
   * @param {...unknown} args - Arguments passed to the git tool.
   * @returns {Promise<unknown>} The restore result.
   */
  restore: async (...args) => (await getTool("gitTools", "restoreFile"))(...args),
  /**
   * Concatenates files.
   * @param {...unknown} args - Arguments passed to the file tool.
   * @returns {Promise<unknown>} The concat result.
   */
  concat: async (...args) => (await getTool("fileTools", "concat"))(...args),
  /**
   * Gets the structure of a JSON file.
   * @param {...unknown} args - Arguments passed to the json tool.
   * @returns {Promise<unknown>} The JSON structure.
   */
  structure: async (...args) =>
    (await getTool("jsonTools", "getJsonStructure"))(...args),
  /**
   * Gets a node from a JSON file.
   * @param {...unknown} args - Arguments passed to the json tool.
   * @returns {Promise<unknown>} The JSON node.
   */
  node: async (...args) => (await getTool("jsonTools", "getJsonNode"))(...args),
  /**
   * Gets array info from a JSON file.
   * @param {...unknown} args - Arguments passed to the json tool.
   * @returns {Promise<unknown>} The JSON array info.
   */
  arrange: async (...args) =>
    (await getTool("jsonTools", "getJsonArrayInfo"))(...args),
  /**
   * Updates a node in a JSON file.
   * @param {...unknown} args - Arguments passed to the json tool.
   * @returns {Promise<unknown>} The update result.
   */
  update: async (...args) => (await getTool("jsonTools", "updateJsonNode"))(...args),
  /**
   * Lists GitHub issues.
   * @param {...unknown} args - Arguments passed to the github tool.
   * @returns {Promise<unknown>} The issues list.
   */
  issues: async (...args) => (await getTool("githubTools", "listIssues"))(...args),
  /**
   * Creates a GitHub issue.
   * @param {...unknown} args - Arguments passed to the github tool.
   * @returns {Promise<unknown>} The creation result.
   */
  create: async (...args) => (await getTool("githubTools", "createIssue"))(...args),
  /**
   * Edits a GitHub issue.
   * @param {...unknown} args - Arguments passed to the github tool.
   * @returns {Promise<unknown>} The edit result.
   */
  edit: async (...args) => (await getTool("githubTools", "editIssue"))(...args),
  /**
   * Closes a GitHub issue.
   * @param {...unknown} args - Arguments passed to the github tool.
   * @returns {Promise<unknown>} The close result.
   */
  close: async (...args) => (await getTool("githubTools", "closeIssue"))(...args),
  /**
   * Posts a comment on a GitHub issue.
   * @param {...unknown} args - Arguments passed to the github tool.
   * @returns {Promise<unknown>} The post result.
   */
  post: async (...args) => (await getTool("githubTools", "postComment"))(...args),
  /**
   * Gets the current git remote.
   * @param {...unknown} args - Arguments passed to the git tool.
   * @returns {Promise<unknown>} The remote info.
   */
  remote: async (...args) => (await getTool("gitTools", "getCurrentRepo"))(...args),
  /**
   * Applies a git patch.
   * @param {...unknown} args - Arguments passed to the git tool.
   * @returns {Promise<unknown>} The patch result.
   */
  patch: async (...args) => (await getTool("gitTools", "applyPatch"))(...args),
  /**
   * Sends a notification to the user.
   * @param {...unknown} args - Arguments passed to the notification tool.
   * @returns {Promise<unknown>} The notification result.
   */
  notify: async (...args) =>
    (await getTool("notificationTools", "notifyUser"))(...args),
  /**
   * Inserts a scene in Fountain format.
   * @param {...unknown} args - Arguments passed to the fountain tool.
   * @returns {Promise<unknown>} The scene insertion result.
   */
  scene: async (...args) =>
    (await getTool("fountainTools", "insertSceneFountain"))(...args),
  /**
   * Lists the contents of a zip file.
   * @param {...unknown} args - Arguments passed to the zip tool.
   * @returns {Promise<unknown>} The zip contents listing.
   */
  zip: async (...args) => (await getTool("zipTools", "listContents"))(...args),
  /**
   * Handles a hex/binary command.
   * @param {...unknown} args - Arguments passed to the binary tool.
   * @returns {Promise<unknown>} The hex command result.
   */
  bin: async (...args) => (await getTool("binaryTools", "handleHexCommand"))(...args),
  /**
   * Searches the web.
   * @param {...unknown} args - Arguments passed to the web tool.
   * @returns {Promise<unknown>} The search results.
   */
  search: async (...args) => (await getTool("webTools", "searchWeb"))(...args),
  /**
   * Renders a webpage.
   * @param {...unknown} args - Arguments passed to the web tool.
   * @returns {Promise<unknown>} The rendered webpage.
   */
  url: async (...args) => (await getTool("webTools", "renderWeb"))(...args),
  /**
   * Fetches raw HTML from a URL.
   * @param {...unknown} args - Arguments passed to the web tool.
   * @returns {Promise<unknown>} The raw HTML content.
   */
  fetch: async (...args) => (await getTool("webTools", "fetchRaw"))(...args),
  /**
   * Executes JavaScript code.
   * @param {...unknown} args - Arguments passed to the eval tool.
   * @returns {Promise<unknown>} The execution result.
   */
  run: async (...args) => (await getTool("evalTools", "executeJS"))(...args),
  /**
   * Analyzes code AST.
   * @param {...unknown} args - Arguments passed to the ast tool.
   * @returns {Promise<unknown>} The AST analysis.
   */
  ast: async (...args) => (await getTool("astTools", "analyze"))(...args),
  /**
   * Gets performance metrics.
   * @param {...unknown} args - Arguments passed to the perf tool.
   * @returns {Promise<unknown>} The metrics data.
   */
  metrics: async (...args) => (await getTool("perfTools", "metrics"))(...args),
  /**
   * Takes a performance snapshot.
   * @param {...unknown} args - Arguments passed to the perf tool.
   * @returns {Promise<unknown>} The snapshot data.
   */
  snapshot: async (...args) => (await getTool("perfTools", "snapshot"))(...args),
  /**
   * Analyzes an image.
   * @param {...unknown} args - Arguments passed to the util tool.
   * @returns {Promise<unknown>} The image analysis.
   */
  img: async (...args) => (await getTool("utilTools", "seeImage"))(...args),
  /**
   * Debugs NodeJS code using built-in inspect repl.
   * @param {...unknown} args - Arguments passed to the inspect tool.
   * @returns {Promise<unknown>} The inspection result.
   */
  inspect: async (...args) => (await getTool("inspectTools", "inspect"))(...args),
  /**
   * Resets the system state.
   * @param {...unknown} args - Arguments passed to the system tool.
   * @returns {Promise<unknown>} The reset result.
   */
  reset: async (...args) => (await getTool("systemTools", "reset"))(...args),
  /**
   * Purges the tool cache.
   * @returns {Promise<string>} The purge confirmation.
   */
  reloadTools: async () => {
    toolCache = {};
    return "Tool cache purged.";
  },
};

const registryPath = path.join(__dirname, "registry_positional.json");
const fullCatalog = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const _S = "Ə";
const _E = "ə";
const systemInstrData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "system_instruction.json"), "utf8"),
);

/**
 * Generates system instructions for the LLM agent based on the available tools.
 * @param {string[]} availableToolNames Array of names of tools that are currently available.
 * @returns {string} The formatted system instruction string containing the tool catalog.
 */
export function generateSystemInstruction(availableToolNames) {
  const filteredCatalog = fullCatalog
    .filter((t) => t[0] !== "executeBash" && availableToolNames.includes(t[0]))
    .map((t) => {
      const canonicalName = t[0];
      const args =
        t[2] && typeof t[2] === "object"
          ? Object.entries(t[2])
              .map(([k]) => `${k}`)
              .join(",")
          : "data";
      const returns = t[1].split(". ")[0] || "status";
      return `${canonicalName}(${args}) ${returns}`;
    })
    .join("\n");

  return systemInstrData.instruction
    .replace(
      "{TOOL_CATALOG}",
      filteredCatalog ? ` ${filteredCatalog} ` : "No tools available.",
    )
    .replaceAll("[[S]]", _S)
    .replaceAll("[[E]]", _E);
}
