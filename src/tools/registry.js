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
  
};

let toolCache = {};

export async function getToolInstance(moduleKey) {
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
  "fs.readFile": async (args) => (await getTool("fileTools", "readFile"))(args),
  "fs.writeFile": async (args) => (await getTool("fileTools", "writeFile"))(args),
  "fs.rm": async (args) => (await getTool("fileTools", "removeFile"))(args),
  "fs.mkdir": async (args) => (await getTool("fileTools", "createDir"))(args),
  "system.reloadSchemas": async (args) => (await getTool("systemTools", "reloadSchemas"))(args),
  "pyright.analyze": async (args) => (await getTool("systemTools", "analyzeCode"))(args),
  "fs.readdir": async (args) => (await getTool("fileTools", "listDir"))(args),
  "fs.replaceString": async (args) => (await getTool("fileTools", "replaceString"))(args),
  "eslint.lint": async (args) => (await getTool("systemTools", "lintCode"))(args),
  "jsdoc.generate": async (args) => (await getTool("systemTools", "generateDocs"))(args),
  "child_process.exec": async (args) => (await getTool("systemTools", "executeBash"))(args),
  "grep.search": async (args) => (await getTool("searchTools", "searchTextGlobal"))(args),
  "glob.search": async (args) => (await getTool("searchTools", "searchFilesPatternFixed"))(args),
  "fs.rename": async (args) => (await getTool("fileTools", "renamePath"))(args),
  "fs.copyFile": async (args) => (await getTool("fileTools", "copyFile"))(args),
  "git.lsFiles": async (args) => (await getTool("fileTools", "getTrackedFiles"))(args),
  "json.validate": async (args) => (await getTool("utilTools", "validateJson"))(args),
  "config.setNickname": async (args) => (await getTool("utilTools", "setNickname"))(args),
  "memento.push": async (args) => (await getTool("memoryTools", "pushMemory"))(args),
  "chatManager.getTokenCount": async (args) => (await getTool("memoryTools", "getTokenCount"))(args),
  "git.diff": async (args) => (await getTool("fileTools", "gitDiff"))(args),
  "git.restore": async (args) => (await getTool("fileTools", "restoreFile"))(args),
  "fs.concatFile": async (args) => (await getTool("fileTools", "concatFile"))(args),
  "json.getStructure": async (args) => (await getTool("jsonTools", "getJsonStructure"))(args),
  "json.getNode": async (args) => (await getTool("jsonTools", "getJsonNode"))(args),
  "json.getArrayInfo": async (args) => (await getTool("jsonTools", "getJsonArrayInfo"))(args),
  "json.updateNode": async (args) => (await getTool("jsonTools", "updateJsonNode"))(args),
  "github.listIssues": async (args) => (await getTool("githubTools", "listIssues"))(args),
  "github.createIssue": async (args) => (await getTool("githubTools", "createIssue"))(args),
  "github.editIssue": async (args) => (await getTool("githubTools", "editIssue"))(args),
  "github.closeIssue": async (args) => (await getTool("githubTools", "closeIssue"))(args),
  "github.postComment": async (args) => (await getTool("githubTools", "postComment"))(args),
  "git.remoteUrl": async (args) => (await getTool("gitTools", "getCurrentRepo"))(args),
  "git.diffAll": async (args) => (await getTool("gitTools", "gitDiffAll"))(args),
  "system.notify": async (args) => (await getTool("notificationTools", "notifyUser"))(args),
  "fountain.insertScene": async (args) => (await getTool("fountainTools", "insertSceneFountain"))(args),
  "jszip.listContents": async (args) => (await getTool("zipTools", "listContents"))(args),
  "binary.analyze": async (args) => (await getTool("binaryTools", "handleHexCommand"))(args),
  "duckduckgo.search": async (args) => (await getTool("webTools", "searchWeb"))(args),
  "elinks.render": async (args) => (await getTool("webTools", "renderWeb"))(args),
  "vm.runInContext": async (args) => (await getTool("evalTools", "executeJS"))(args),
  "ast.analyze": async (args) => (await getTool("astTools", "analyze"))(args),
  "seeImage": async (args) => (await getTool("utilTools", "seeImage"))(args),
  "reloadTools": async () => {
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
