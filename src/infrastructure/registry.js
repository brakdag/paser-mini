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
   *
   * @param {...any} args
   */
  read: async (...args) => (await getTool("fileTools", "read"))(...args),
  /**
   *
   * @param {...any} args
   */
  tail: async (...args) => (await getTool("fileTools", "tail"))(...args),
  /**
   *
   * @param {...any} args
   */
  write: async (...args) => (await getTool("fileTools", "write"))(...args),
  /**
   *
   * @param {...any} args
   */
  remove: async (...args) => (await getTool("fileTools", "remove"))(...args),
  /**
   *
   * @param {...any} args
   */
  mkdir: async (...args) => (await getTool("fileTools", "mkdir"))(...args),
  /**
   *
   * @param {...any} args
   */
  reloadSchemas: async (...args) =>
    (await getTool("systemTools", "reloadSchemas"))(...args),
  /**
   *
   * @param {...any} args
   */
  analysis: async (...args) => (await getTool("systemTools", "analyzeCode"))(...args),
  /**
   *
   * @param {...any} args
   */
  list: async (...args) => (await getTool("fileTools", "list"))(...args),
  /**
   *
   * @param {...any} args
   */
  replace: async (...args) => (await getTool("fileTools", "replace"))(...args),
  /**
   *
   * @param {...any} args
   */
  eslint: async (...args) => (await getTool("systemTools", "lintCode"))(...args),
  /**
   *
   * @param {...any} args
   */
  doc: async (...args) => (await getTool("systemTools", "generateDocs"))(...args),
  /**
   *
   * @param {...any} args
   */
  execute: async (...args) => (await getTool("systemTools", "executeBash"))(...args),
  /**
   *
   * @param {...any} args
   */
  grep: async (...args) =>
    (await getTool("searchTools", "searchTextGlobal"))(...args),
  /**
   *
   * @param {...any} args
   */
  glob: async (...args) =>
    (await getTool("searchTools", "searchFilesPatternFixed"))(...args),
  /**
   *
   * @param {...any} args
   */
  rename: async (...args) => (await getTool("fileTools", "rename"))(...args),
  /**
   *
   * @param {...any} args
   */
  copy: async (...args) => (await getTool("fileTools", "copy"))(...args),
  /**
   *
   * @param {...any} args
   */
  tree: async (...args) => (await getTool("gitTools", "getTrackedFiles"))(...args),
  /**
   *
   * @param {...any} args
   */
  valide: async (...args) => (await getTool("utilTools", "validateJson"))(...args),
  /**
   *
   * @param {...any} args
   */
  nickname: async (...args) => (await getTool("utilTools", "setNickname"))(...args),
  /**
   *
   * @param {...any} args
   */
  push: async (...args) => (await getTool("memoryTools", "pushMemory"))(...args),
  /**
   *
   * @param {...any} args
   */
  token: async (...args) => (await getTool("memoryTools", "getTokenCount"))(...args),
  /**
   *
   * @param {...any} args
   */
  diff: async (...args) => (await getTool("gitTools", "gitDiffAll"))(...args),
  /**
   *
   * @param {...any} args
   */
  restore: async (...args) => (await getTool("gitTools", "restoreFile"))(...args),
  /**
   *
   * @param {...any} args
   */
  concat: async (...args) => (await getTool("fileTools", "concat"))(...args),
  /**
   *
   * @param {...any} args
   */
  structure: async (...args) =>
    (await getTool("jsonTools", "getJsonStructure"))(...args),
  /**
   *
   * @param {...any} args
   */
  node: async (...args) => (await getTool("jsonTools", "getJsonNode"))(...args),
  /**
   *
   * @param {...any} args
   */
  arrange: async (...args) =>
    (await getTool("jsonTools", "getJsonArrayInfo"))(...args),
  /**
   *
   * @param {...any} args
   */
  update: async (...args) => (await getTool("jsonTools", "updateJsonNode"))(...args),
  /**
   *
   * @param {...any} args
   */
  issues: async (...args) => (await getTool("githubTools", "listIssues"))(...args),
  /**
   *
   * @param {...any} args
   */
  create: async (...args) => (await getTool("githubTools", "createIssue"))(...args),
  /**
   *
   * @param {...any} args
   */
  edit: async (...args) => (await getTool("githubTools", "editIssue"))(...args),
  /**
   *
   * @param {...any} args
   */
  close: async (...args) => (await getTool("githubTools", "closeIssue"))(...args),
  /**
   *
   * @param {...any} args
   */
  post: async (...args) => (await getTool("githubTools", "postComment"))(...args),
  /**
   *
   * @param {...any} args
   */
  remote: async (...args) => (await getTool("gitTools", "getCurrentRepo"))(...args),
  /**
   *
   * @param {...any} args
   */
  patch: async (...args) => (await getTool("gitTools", "applyPatch"))(...args),
  /**
   *
   * @param {...any} args
   */
  notify: async (...args) =>
    (await getTool("notificationTools", "notifyUser"))(...args),
  /**
   *
   * @param {...any} args
   */
  scene: async (...args) =>
    (await getTool("fountainTools", "insertSceneFountain"))(...args),
  /**
   *
   * @param {...any} args
   */
  zip: async (...args) => (await getTool("zipTools", "listContents"))(...args),
  /**
   *
   * @param {...any} args
   */
  bin: async (...args) => (await getTool("binaryTools", "handleHexCommand"))(...args),
  /**
   *
   * @param {...any} args
   */
  search: async (...args) => (await getTool("webTools", "searchWeb"))(...args),
  /**
   *
   * @param {...any} args
   */
  url: async (...args) => (await getTool("webTools", "renderWeb"))(...args),
  /**
   *
   * @param {...any} args
   */
  run: async (...args) => (await getTool("evalTools", "executeJS"))(...args),
  /**
   *
   * @param {...any} args
   */
  ast: async (...args) => (await getTool("astTools", "analyze"))(...args),
  /**
   *
   * @param {...any} args
   */
  metrics: async (...args) => (await getTool("perfTools", "metrics"))(...args),
  /**
   *
   * @param {...any} args
   */
  snapshot: async (...args) => (await getTool("perfTools", "snapshot"))(...args),
  /**
   *
   * @param {...any} args
   */
  img: async (...args) => (await getTool("utilTools", "seeImage"))(...args),
  /**
   *
   * @param {...any} args
   */
  reset: async (...args) => (await getTool("systemTools", "reset"))(...args),
  /**
   *
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
