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
  loadTools: "../tools/loadTools.js",
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
    const module = await import(modulePath);
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

/**
 * Map of available tools to their wrapper functions.
 * @type {{[key: string]: (...args: unknown[]) => Promise<unknown>}}
 */
export const AVAILABLE_TOOLS = {
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  read: async (...args) => (await getTool("fileTools", "read"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  tail: async (...args) => (await getTool("fileTools", "tail"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  write: async (...args) => (await getTool("fileTools", "write"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  remove: async (...args) => (await getTool("fileTools", "remove"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  mkdir: async (...args) => (await getTool("fileTools", "mkdir"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  reloadSchemas: async (...args) =>
    (await getTool("systemTools", "reloadSchemas"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  analysis: async (...args) => (await getTool("systemTools", "analyzeCode"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  list: async (...args) => (await getTool("fileTools", "list"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  replace: async (...args) => (await getTool("fileTools", "replace"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  sed: async (...args) => (await getTool("fileTools", "sed"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  eslint: async (...args) => (await getTool("systemTools", "lintCode"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  doc: async (...args) => (await getTool("systemTools", "generateDocs"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  execute: async (...args) => (await getTool("systemTools", "execute"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  grep: async (...args) =>
    (await getTool("searchTools", "searchText"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  glob: async (...args) =>
    (await getTool("searchTools", "searchFilesPatternFixed"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  rename: async (...args) => (await getTool("fileTools", "rename"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  copy: async (...args) => (await getTool("fileTools", "copy"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  tree: async (...args) => (await getTool("gitTools", "getTrackedFiles"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  validate: async (...args) => (await getTool("utilTools", "validateJson"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  nickname: async (...args) => (await getTool("utilTools", "setNickname"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  push: async (...args) => (await getTool("memoryTools", "pushMemory"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  token: async (...args) => (await getTool("memoryTools", "getTokenCount"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  diff: async (...args) => (await getTool("gitTools", "gitDiffAll"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  restore: async (...args) => (await getTool("gitTools", "restoreFile"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  concat: async (...args) => (await getTool("fileTools", "concat"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  structure: async (...args) =>
    (await getTool("jsonTools", "getJsonStructure"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  node: async (...args) => (await getTool("jsonTools", "getJsonNode"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  arrange: async (...args) =>
    (await getTool("jsonTools", "getJsonArrayInfo"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  update: async (...args) => (await getTool("jsonTools", "updateJsonNode"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  issues: async (...args) => (await getTool("githubTools", "listIssues"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  create: async (...args) => (await getTool("githubTools", "createIssue"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  edit: async (...args) => (await getTool("githubTools", "editIssue"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  close: async (...args) => (await getTool("githubTools", "closeIssue"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  post: async (...args) => (await getTool("githubTools", "postComment"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  remote: async (...args) => (await getTool("gitTools", "getCurrentRepo"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  patch: async (...args) => (await getTool("gitTools", "applyPatch"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  notify: async (...args) =>
    (await getTool("notificationTools", "notifyUser"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  scene: async (...args) =>
    (await getTool("fountainTools", "insertSceneFountain"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  zip: async (...args) => (await getTool("zipTools", "listContents"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  bin: async (...args) => (await getTool("binaryTools", "handleHexCommand"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  search: async (...args) => (await getTool("webTools", "searchWeb"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  url: async (...args) => (await getTool("webTools", "renderWeb"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  fetch: async (...args) => (await getTool("webTools", "fetchRaw"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  run: async (...args) => (await getTool("evalTools", "executeJS"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  ast: async (...args) => (await getTool("astTools", "analyze"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  metrics: async (...args) => (await getTool("perfTools", "metrics"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  snapshot: async (...args) => (await getTool("perfTools", "snapshot"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  img: async (...args) => (await getTool("utilTools", "seeImage"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  inspect: async (...args) => (await getTool("inspectTools", "inspect"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  reset: async (...args) => (await getTool("systemTools", "reset"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  index: async (...args) => (await getTool("loadTools", "index"))(...args),
  /**
   * @param {unknown[]} args Arguments.
   * @returns {Promise<unknown>} Result.
   */
  load: async (...args) => (await getTool("loadTools", "load"))(...args),
  /**
   * @returns {Promise<string>} Confirmation message.
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
    .filter((t) => t[0] !== "execute" && availableToolNames.includes(t[0]))
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