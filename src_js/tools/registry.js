import fs from 'fs';
import path from 'path';
import * as fileTools from './fileTools.js';
import * as systemTools from './systemTools.js';
import * as utilTools from './utilTools.js';
import * as searchTools from './searchTools.js';
import * as instanceTools from './instanceTools.js';
import * as memoryTools from './memoryTools.js';
import * as jsonTools from './jsonTools.js';
import * as githubTools from './githubTools.js';
import * as gitTools from './gitTools.js';

export const GITHUB_SYSTEM_INSTRUCTION = '## GitHub Mode Protocol\nYou are operating in GitHub Mode. Your primary interface is GitHub Issues.\n1. Communication: You are not in a live chat. All communication must be done via GitHub issue comments.\n2. Planning: Before executing any engineering changes, you MUST post a comment with a detailed Work Plan.\n3. Progress Tracking: Use a Markdown checklist in your plan. As you complete each task, post a progress update comment marking the task as completed.\n4. Transparency: Be explicit about what you are doing and why. Since the user is not watching your internal process, your comments are the only way they know the agent is still active and making progress.';

export const AVAILABLE_TOOLS = {
    "readFile": fileTools.readFile,
    "writeFile": fileTools.writeFile,
    "removeFile": fileTools.removeFile,
        "createDir": fileTools.createDir,
    "listDir": fileTools.listDir,
    "replaceString": fileTools.replaceString,
    "analyzePyright": systemTools.analyzePyright,
    "searchTextGlobal": searchTools.searchTextGlobal,
    "searchFilesPattern": searchTools.searchFilesPattern,
    "renamePath": fileTools.renamePath,
    "copyFile": fileTools.copyFile,
    "getTree": fileTools.getTree,
    "validateJson": utilTools.validateJson,
        "setNickname": utilTools.setNickname,
    "runPython": instanceTools.runPython,
    "newAgent": instanceTools.newAgent,
    "pushMemory": memoryTools.pushMemory,
    "pullMemory": memoryTools.pullMemory,
    "getTokenCount": memoryTools.getTokenCount,
    "gitDiff": fileTools.gitDiff,
    "restoreFile": fileTools.restoreFile,
    "codeFormatter": fileTools.codeFormatter,
    "concatFile": fileTools.concatFile,
    "verifyImplementation": instanceTools.verifyImplementation,
    "getJsonStructure": jsonTools.getJsonStructure,
    "getJsonNode": jsonTools.getJsonNode,
    "getJsonArrayInfo": jsonTools.getJsonArrayInfo,
    "updateJsonNode": jsonTools.updateJsonNode,
    "listIssues": githubTools.listIssues,
    "createIssue": githubTools.createIssue,
    "editIssue": githubTools.editIssue,
    "closeIssue": githubTools.closeIssue,
    "postComment": githubTools.postComment,
    "getCurrentRepo": gitTools.getCurrentRepo,
    "gitDiffAll": gitTools.gitDiffAll,
};

const registryPath = 'src_js/tools/registry_positional.json';
const full_catalog = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const TOOL_CATALOG = full_catalog.map(t => `${t[0]}(${Object.keys(t[2]).join(', ')}) - ${t[1]}`).join('\n');

const _S = String.fromCharCode(60) + "TOOL" + "_CALL" + String.fromCharCode(62);
const _E = String.fromCharCode(60) + "/" + "TOOL" + "_CALL" + String.fromCharCode(62);

const systemInstrData = JSON.parse(fs.readFileSync('src_js/tools/system_instruction.json', 'utf8'));
export const SYSTEM_INSTRUCTION = systemInstrData.instruction.replace('{TOOL_CATALOG}', TOOL_CATALOG).replace('[[S]]', _S).replace('[[E]]', _E);
