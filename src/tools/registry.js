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
};

let toolCache = {};

async function getToolInstance(moduleKey) {
  if (!toolCache[moduleKey]) {
    const modulePath = MODULE_MAP[moduleKey];
    if (!modulePath) throw new Error(`Module ${moduleKey} not mapped.`);
    const module = await import(`${modulePath}?update=${Date.now()}`);

    // Derive class name. Need to handle special case for GithubTools
    let className = moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
    if (moduleKey === "githubTools") className = "GithubTools";

    const ToolClass = module[className];
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
  "## GitHub Mode Protocol\n" +
  "You are operating in GitHub Mode. Your primary interface is GitHub Issues.\n" +
  "1. Communication: You are not in a live chat. All communication must be done via GitHub issue comments.\n" +
  "2.Planning: Before executing any engineering changes, you MUST post a comment with a detailed Work Plan.\n" +
  "3. Progress Tracking: Use a Markdown checklist in your plan.\n" +
  "   As you complete each task, post a progress update comment marking the task as completed.\n" +
  "4. Transparency: Be explicit about what you are doing and why.\n" +
  "   Since the user is not watching your internal process, your comments are the only way\n" +
  "they know the agent is still active and making progress.";

export const AVAILABLE_TOOLS = {
  readFile: async (args) => (await getTool("fileTools", "readFile"))(args),
  writeFile: async (args) => (await getTool("fileTools", "writeFile"))(args),
  removeFile: async (args) => (await getTool("fileTools", "removeFile"))(args),
  createDir: async (args) => (await getTool("fileTools", "createDir"))(args),
  reloadSchemas: async (args) =>
    (await getTool("systemTools", "reloadSchemas"))(args),
  analyzeCode: async (args) =>
    (await getTool("systemTools", "analyzeCode"))(args),
  listDir: async (args) => (await getTool("fileTools", "listDir"))(args),
  replaceString: async (args) =>
    (await getTool("fileTools", "replaceString"))(args),
  lintCode: async (args) => (await getTool("systemTools", "lintCode"))(args),
  generateDocs: async (args) =>
    (await getTool("systemTools", "generateDocs"))(args),
  executeBash: async (args) =>
    (await getTool("systemTools", "executeBash"))(args),
  searchTextGlobal: async (args) =>
    (await getTool("searchTools", "searchTextGlobal"))(args),
  searchFilesPattern: async (args) =>
    (await getTool("searchTools", "searchFilesPatternFixed"))(args),
  renamePath: async (args) => (await getTool("fileTools", "renamePath"))(args),
  copyFile: async (args) => (await getTool("fileTools", "copyFile"))(args),
  getTrackedFiles: async (args) =>
    (await getTool("fileTools", "getTrackedFiles"))(args),
  validateJson: async (args) =>
    (await getTool("utilTools", "validateJson"))(args),
  setNickname: async (args) =>
    (await getTool("utilTools", "setNickname"))(args),
  pushMemory: async (args) =>
    (await getTool("memoryTools", "pushMemory"))(args),
  getTokenCount: async (args) =>
    (await getTool("memoryTools", "getTokenCount"))(args),
  gitDiff: async (args) => (await getTool("fileTools", "gitDiff"))(args),
  restoreFile: async (args) =>
    (await getTool("fileTools", "restoreFile"))(args),
  concatFile: async (args) => (await getTool("fileTools", "concatFile"))(args),
  getJsonStructure: async (args) =>
    (await getTool("jsonTools", "getJsonStructure"))(args),
  getJsonNode: async (args) =>
    (await getTool("jsonTools", "getJsonNode"))(args),
  getJsonArrayInfo: async (args) =>
    (await getTool("jsonTools", "getJsonArrayInfo"))(args),
  updateJsonNode: async (args) =>
    (await getTool("jsonTools", "updateJsonNode"))(args),
  listIssues: async (args) =>
    (await getTool("githubTools", "listIssues"))(args),
  createIssue: async (args) =>
    (await getTool("githubTools", "createIssue"))(args),
  editIssue: async (args) => (await getTool("githubTools", "editIssue"))(args),
  closeIssue: async (args) =>
    (await getTool("githubTools", "closeIssue"))(args),
  postComment: async (args) =>
    (await getTool("githubTools", "postComment"))(args),
  getCurrentRepo: async (args) =>
    (await getTool("gitTools", "getCurrentRepo"))(args),
  gitDiffAll: async (args) => (await getTool("gitTools", "gitDiffAll"))(args),
  notifyUser: async (args) =>
    (await getTool("notificationTools", "notifyUser"))(args),
  insertSceneFountain: async (args) =>
    (await getTool("fountainTools", "insertSceneFountain"))(args),
  loadZip: async (args) => (await getTool("zipTools", "loadZip"))(args),
  readZipFile: async (args) => (await getTool("zipTools", "readZipFile"))(args),
  writeZipFile: async (args) =>
    (await getTool("zipTools", "writeZipFile"))(args),
  saveZip: async (args) => (await getTool("zipTools", "saveZip"))(args),
  listZipFiles: async (args) =>
    (await getTool("zipTools", "listZipFiles"))(args),
  binaryAnalysis: async (args) =>
    (await getTool("binaryTools", "handleHexCommand"))(args),
  searchWeb: async (args) => (await getTool("webTools", "searchWeb"))(args),
  renderWeb: async (args) => (await getTool("webTools", "renderWeb"))(args),
  executeJS: async (args) => (await getTool("evalTools", "executeJS"))(args),
  reloadTools: async () => {
    toolCache = {};
    return "Tool cache purged. All modules will be reloaded on next call.";
  },
};

const registryPath = path.join(__dirname, "registry_positional.json");
const fullCatalog = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const TOOL_CATALOG = fullCatalog
  .filter((t) => t[0] !== "executeBash")
  .map((t) => {
    const canonicalName = t[0];
    const args =
      t[2] && typeof t[2] === "object" ? Object.keys(t[2]).join(", ") : "data";
    const returns = t[1].split(". ")[0] || "status";
    return `${canonicalName}(${args}): returns ${returns}`;
  })
  .join("\n");

const _S = `${String.fromCharCode(60)}TOOL_CALL${String.fromCharCode(62)}`;
const _E = `${String.fromCharCode(60)}/TOOL_CALL${String.fromCharCode(62)}`;

const systemInstrData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "system_instruction.json"), "utf8"),
);
export const SYSTEM_INSTRUCTION = systemInstrData.instruction
  .replace("{TOOL_CATALOG}", TOOL_CATALOG)
  .replace("[[S]]", _S)
  .replace("[[E]]", _E);
