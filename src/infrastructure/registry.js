import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import TOOL_DEFINITIONS from "./toolDefinitions.js";

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
  qrTools: "../tools/qrTools.js",
};

let toolCache = {};
const pendingTools = new Map();
let toolsStopping = false;
let toolsPermanentlyStopped = false;
let toolShutdown = null;

/**
 * Retrieves the singleton instance of a tool based on its module key.
 * @param {string} moduleKey The key of the module to instantiate.
 * @returns {Promise<object>} The instantiated tool object.
 */
export async function getToolInstance(moduleKey) {
  if (toolsStopping) throw new Error("Tool registry is shutting down");
  if (toolCache[moduleKey]) return toolCache[moduleKey];
  if (!pendingTools.has(moduleKey)) {
    const pending = (async () => {
      const modulePath = MODULE_MAP[moduleKey];
      if (!modulePath) throw new Error(`Module ${moduleKey} not mapped.`);
      const module = await import(modulePath);
      let className = moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
      if (moduleKey === "githubTools") className = "GithubTools";
      const ToolClass = module[className] || module.default;
      if (!ToolClass) throw new Error(`Class ${className} not found in ${modulePath}`);
      if (toolsStopping) throw new Error("Tool registry is shutting down");
      toolCache[moduleKey] = new ToolClass();
      return toolCache[moduleKey];
    })();
    pendingTools.set(moduleKey, pending);
  }
  try {
    return await pendingTools.get(moduleKey);
  } finally {
    pendingTools.delete(moduleKey);
  }
}

/**
 * Closes tools, including imports in flight, before releasing their cache.
 * @param {boolean} [permanent] - Reject future tool acquisitions during application shutdown.
 * @returns {Promise<void>} Shared completion for concurrent cleanup requests.
 */
export function shutdownTools(permanent = false) {
  toolsPermanentlyStopped ||= permanent;
  if (toolShutdown) return toolShutdown;
  toolsStopping = true;
  toolShutdown = Promise.resolve().then(async () => {
    await Promise.allSettled(pendingTools.values());
    const instances = Object.values(toolCache);
    toolCache = {};
    const results = await Promise.allSettled(instances.map(instance => Promise.resolve().then(() => instance.close?.())));
    const errors = results.filter(result => result.status === "rejected").map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, "Tool cleanup failed");
  }).finally(() => {
    if (!toolsPermanentlyStopped) {
      toolsStopping = false;
      toolShutdown = null;
    }
  });
  return toolShutdown;
}

/**
 * Creates executable wrappers from the shared contracts. Instance resolution is
 * injectable so contract tests never initialize external clients or sessions.
 * @param {(moduleKey: string) => Promise<object>} [resolveInstance] - Tool instance resolver.
 * @returns {object} Tool functions keyed by public name.
 */
export function createTools(resolveInstance = getToolInstance) {
  return Object.fromEntries(Object.entries(TOOL_DEFINITIONS).map(([name, definition]) => [
    name,
    async (...args) => {
      if (name === "reloadTools") {
        await shutdownTools();
        return "Tool cache purged.";
      }
      const instance = await resolveInstance(definition.moduleKey);
      const method = instance[definition.method];
      if (typeof method !== "function") throw new Error(`Method ${definition.method} not found in ${definition.moduleKey}.`);
      const implementationArgs = definition.adaptArguments ? definition.adaptArguments(args) : args;
      return method.apply(instance, implementationArgs);
    },
  ]));
}

export const AVAILABLE_TOOLS = createTools();

const _S = "Ə";
const _E = "ə";
const systemInstrData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "system_instruction.json"), "utf8"),
);

/**
 * Generates system instructions for the LLM agent based on the available tools.
 * @param {string[]} availableToolNames Array of names of tools that are currently available.
 * @param {object} [mcpSchemas] Optional map of dynamic JSON schemas for MCP tools.
 * @returns {string} The formatted system instruction string containing the tool catalog.
 */
export function generateSystemInstruction(availableToolNames, mcpSchemas = {}) {
  const filteredCatalog = Object.entries(TOOL_DEFINITIONS)
    .filter(([name, definition]) => !definition.requiresBash && availableToolNames.includes(name))
    .map(([name, definition]) => `${name}(${definition.parameters.join(",")}) ${definition.description}`)
    .join("\n");

  const mcpCatalog = availableToolNames
    .filter((name) => name.startsWith("mcp_"))
    .map((name) => {
      const schema = mcpSchemas[name];
      if (!schema) return "";
      const args = Object.keys(schema.properties || {}).join(",");
      const desc = schema.description ? schema.description.split(". ")[0] : "status";
      return `${name}(${args}) ${desc}`;
    })
    .filter(Boolean)
    .join("\n");

  const combinedCatalog = [filteredCatalog, mcpCatalog].filter(Boolean).join("\n");

  return systemInstrData.instruction
    .replace(
      "{TOOL_CATALOG}",
      combinedCatalog ? ` ${combinedCatalog} ` : "No tools available.",
    )
    .replaceAll("[[S]]", _S)
    .replaceAll("[[E]]", _E);
}
