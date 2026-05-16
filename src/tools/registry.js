import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as fileTools from "./fileTools";
import * as systemTools from "./systemTools";
import * as utilTools from "./utilTools";
import * as searchTools from "./searchTools";
import * as memoryTools from "./memoryTools";
import * as jsonTools from "./jsonTools";
import * as githubTools from "./githubTools";
import * as gitTools from "./gitTools";
import * as notificationTools from "./notificationTools";
import * as fountainTools from "./fountainTools";
import * as zipTools from "./zipTools";
import * as binaryTools from "./binaryTools";
import * as dockerTools from "./dockerTools";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const GITHUB_SYSTEM_INSTRUCTION =
  "## GitHub Mode Protocol\n" +
  "You are operating in GitHub Mode. Your primary interface is GitHub Issues.\n" +
  "1. Communication: You are not in a live chat. All communication must be done via GitHub issue comments.\n" +
  "2.Planning: Before executing any engineering changes, you MUST post a comment with a detailed Work Plan.\n" +
  "3. Progress Tracking: Use a Markdown checklist in your plan.\n" +
  "   As you complete each task, post a progress update comment marking the task as completed.\n" +
  "4. Transparency: Be explicit about what you are doing and why.\n" +
  "   Since the user is not watching your internal process, your comments are the only way\n" +
  "   they know the agent is still active and making progress.";

export const AVAILABLE_TOOLS = {
  readFile: fileTools.readFile,
  writeFile: fileTools.writeFile,
  removeFile: fileTools.removeFile,
  createDir: fileTools.createDir,
  reloadSchemas: systemTools.reloadSchemas,
  analyzeCode: systemTools.analyzeCode,
  listDir: fileTools.listDir,
  replaceString: fileTools.replaceString,
  lintCode: systemTools.lintCode,
  generateDocs: systemTools.generateDocs,
  executeBash: systemTools.executeBash,
  searchTextGlobal: searchTools.searchTextGlobal,
  searchFilesPattern: searchTools.searchFilesPatternFixed,
  renamePath: fileTools.renamePath,
  copyFile: fileTools.copyFile,
  getTrackedFiles: fileTools.getTrackedFiles,
  validateJson: utilTools.validateJson,
  setNickname: utilTools.setNickname,
  pushMemory: memoryTools.pushMemory,
  getTokenCount: memoryTools.getTokenCount,
  gitDiff: fileTools.gitDiff,
  restoreFile: fileTools.restoreFile,
  concatFile: fileTools.concatFile,
  getJsonStructure: jsonTools.getJsonStructure,
  getJsonNode: jsonTools.getJsonNode,
  getJsonArrayInfo: jsonTools.getJsonArrayInfo,
  updateJsonNode: jsonTools.updateJsonNode,
  listIssues: githubTools.listIssues,
  createIssue: githubTools.createIssue,
  editIssue: githubTools.editIssue,
  closeIssue: githubTools.closeIssue,
  postComment: githubTools.postComment,
  getCurrentRepo: gitTools.getCurrentRepo,
  gitDiffAll: gitTools.gitDiffAll,
  notifyUser: notificationTools.notifyUser,
  insertSceneFountain: fountainTools.insertSceneFountain,
  loadZip: zipTools.loadZip,
  readZipFile: zipTools.readZipFile,
  writeZipFile: zipTools.writeZipFile,
  saveZip: zipTools.saveZip,
  listZipFiles: zipTools.listZipFiles,
  binaryAnalysis: binaryTools.handleHexCommand,
  sh: dockerTools.sh,
};

const registryPath = path.join(__dirname, "registry_positional.json");
const fullCatalog = JSON.parse(fs.readFileSync(registryPath, "utf8"));

export const TOOL_ALIASES = {
  cat: "readFile",
  write: "writeFile",
  rm: "removeFile",
  ls: "listDir",
  sed: "replaceString",
  replace: "replaceString",
  edit: "replaceString",
  analyze: "analyzeCode",
  lint: "lintCode",
  docs: "generateDocs",
  grep: "searchTextGlobal",
  find: "searchFilesPattern",
  mv: "renamePath",
  cp: "copyFile",
  "json-val": "validateJson",
  nick: "setNickname",
  "mem-push": "pushMemory",
  tokens: "getTokenCount",
  tree: "getTrackedFiles",
  diff: "gitDiff",
  restore: "restoreFile",
  append: "concatFile",
  "json-struct": "getJsonStructure",
  "json-get": "getJsonNode",
  "json-arr": "getJsonArrayInfo",
  "json-set": "updateJsonNode",
  "issues-ls": "listIssues",
  "issue-new": "createIssue",
  "issue-edit": "editIssue",
  "issue-close": "closeIssue",
  "issue-com": "postComment",
  repo: "getCurrentRepo",
  "diff-all": "gitDiffAll",
  notify: "notifyUser",
  scene: "insertSceneFountain",
  "zip-load": "loadZip",
  "zip-cat": "readZipFile",
  "zip-write": "writeZipFile",
  "zip-save": "saveZip",
  "zip-ls": "listZipFiles",
  "bin-analyze": "binaryAnalysis",
  sh: "sh",
};

const TOOL_CATALOG = fullCatalog
  .filter((t) => t[0] !== "executeBash")
  .map((t) => {
    const canonicalName = t[0];
    const alias =
      Object.keys(TOOL_ALIASES).find(
        (key) => TOOL_ALIASES[key] === canonicalName,
      ) || canonicalName;
    const args =
      t[2] && typeof t[2] === "object" ? Object.keys(t[2]).join(", ") : "data";
    const returns = t[1].split(". ")[0] || "status";
    return `${alias}(${args}): returns ${returns}`;
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
