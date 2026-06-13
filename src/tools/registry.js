import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_MAP = {
  fileTools: "./fileTools.js",
  systemTools: "./systemTools.js",
  utilTools: "./utilTools.js",
  searchTools: "./searchTools.js",
  memoryTools: "./memoryTools.js",
  jsonTools: "./jsonTools.js",
  githubTools: "./githubTools.js",
  gitTools: "./gitTools.js",
  notificationTools: "./notificationTools.js",
  fountainTools: "./fountainTools.js",
  zipTools: "./zipTools.js",
  binaryTools: "./binaryTools.js",
  webTools: "./webTools.js",
  evalTools: "./evalTools.js",
  astTools: "./astTools.js",
  perfTools: "./perfTools.js",
  mockTools: "./mockTools.js",
};

let toolCache = {};

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

async function getTool(moduleKey, funcName) {
  const instance = await getToolInstance(moduleKey);
  const func = instance[funcName];
  if (!func) throw new Error(`Method ${funcName} not found in ${moduleKey}.`);
  return func.bind(instance);
}

export const GITHUB_SYSTEM_INSTRUCTION =
  "## GitHub Mode Protocol\nYou are operating in GitHub Mode. Your primary interface is GitHub/Issues.\n1. Communication: All via GitHub issue comments.\n2. Planning: Post a detailed Work Plan first.\n3. Progress: Use Markdown checklists.\n4. Transparency: Be explicit about actions.";

export const AVAILABLE_TOOLS = {
  read: async (args) => (await getTool("fileTools", "readFile"))(args),
  write: async (args) => (await getTool("fileTools", "writeFile"))(args),
  rm: async (args) => (await getTool("fileTools", "removeFile"))(args),
  mkdir: async (args) => (await getTool("fileTools", "createDir"))(args),
  reloadSchemas: async (args) =>
    (await getTool("systemTools", "reloadSchemas"))(args),
  reset: async (args) => (await getTool("systemTools", "reset"))(args),
  analysis: async (args) => (await getTool("systemTools", "analyzeCode"))(args),
  ls: async (args) => (await getTool("fileTools", "listDir"))(args),
  replace: async (args) => (await getTool("fileTools", "replaceString"))(args),
  eslint: async (args) => (await getTool("systemTools", "lintCode"))(args),
  doc: async (args) => (await getTool("systemTools", "generateDocs"))(args),
  execute: async (args) => (await getTool("systemTools", "executeBash"))(args),
  grep: async (args) =>
    (await getTool("searchTools", "searchTextGlobal"))(args),
  glob: async (args) =>
    (await getTool("searchTools", "searchFilesPatternFixed"))(args),
  rename: async (args) => (await getTool("fileTools", "renamePath"))(args),
  copy: async (args) => (await getTool("fileTools", "copyFile"))(args),
  tree: async (args) => (await getTool("fileTools", "getTrackedFiles"))(args),
  valide: async (args) => (await getTool("utilTools", "validateJson"))(args),
  nickname: async (args) => (await getTool("utilTools", "setNickname"))(args),
  push: async (args) => (await getTool("memoryTools", "pushMemory"))(args),
  token: async (args) => (await getTool("memoryTools", "getTokenCount"))(args),
  diff: async (args) => (await getTool("fileTools", "gitDiff"))(args),
  restore: async (args) => (await getTool("fileTools", "restoreFile"))(args),
  concat: async (args) => (await getTool("fileTools", "concatFile"))(args),
  structure: async (args) =>
    (await getTool("jsonTools", "getJsonStructure"))(args),
  node: async (args) => (await getTool("jsonTools", "getJsonNode"))(args),
  arrange: async (args) =>
    (await getTool("jsonTools", "getJsonArrayInfo"))(args),
  update: async (args) => (await getTool("jsonTools", "updateJsonNode"))(args),
  list: async (args) => (await getTool("githubTools", "listIssues"))(args),
  create: async (args) => (await getTool("githubTools", "createIssue"))(args),
  edit: async (args) => (await getTool("githubTools", "editIssue"))(args),
  close: async (args) => (await getTool("githubTools", "closeIssue"))(args),
  post: async (args) => (await getTool("githubTools", "postComment"))(args),
  remote: async (args) => (await getTool("gitTools", "getCurrentRepo"))(args),
  difference: async (args) => (await getTool("gitTools", "gitDiffAll"))(args),
  patch: async (args) => (await getTool("gitTools", "applyPatch"))(args),
  notify: async (args) =>
    (await getTool("notificationTools", "notifyUser"))(args),
  scene: async (args) =>
    (await getTool("fountainTools", "insertSceneFountain"))(args),
  jszip: async (args) => (await getTool("zipTools", "listContents"))(args),
  bin: async (args) => (await getTool("binaryTools", "handleHexCommand"))(args),
  search: async (args) => (await getTool("webTools", "searchWeb"))(args),
  url: async (args) => (await getTool("webTools", "renderWeb"))(args),
  run: async (args) => (await getTool("evalTools", "executeJS"))(args),
  ast: async (args) => (await getTool("astTools", "analyze"))(args),
  metrics: async (args) => (await getTool("perfTools", "metrics"))(args),
  snapshot: async (args) => (await getTool("perfTools", "snapshot"))(args),
  img: async (args) => (await getTool("utilTools", "seeImage"))(args),
  real: async (args) => (await getTool("mockTools", "realAction"))(args),
  reset: async (args) => (await getTool("systemTools", "reset"))(args),
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

export function generateSystemInstruction(availableToolNames) {
  const filteredCatalog = fullCatalog
    .filter((t) => t[0] !== "executeBash" && availableToolNames.includes(t[0]))
    .map((t) => {
      const canonicalName = t[0];
      const args =
        t[2] && typeof t[2] === "object"
          ? Object.entries(t[2])
              .map(([k, v]) => `${k} (${v})`)
              .join(", ")
          : "data";
      const returns = t[1].split(". ")[0] || "status";
      return `${canonicalName}(${args}): returns ${returns}`;
    })
    .join("\n");

  return systemInstrData.instruction
    .replace(
      "{TOOL_CATALOG}",
      filteredCatalog ? ` ${filteredCatalog} ` : "No tools available.",
    )
    .replace("[[S]]", _S)
    .replace("[[E]]", _E);
}
