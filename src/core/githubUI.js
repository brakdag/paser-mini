import * as githubTools from '../tools/githubTools.js';

export class GitHubUI {
  constructor(issueNumber, repo = null) {
    this.issueNumber = issueNumber;
    this.repo = repo;
  }

  async requestInput(prompt, history = null) {
    // En modo GitHub, la entrada es gestionada por el orquestador vía cola de mensajes
    return '';
  }

  displayMessage(text) {
    console.log(`[POSTING TO GITHUB] Issue #${this.issueNumber}: ${text}`);
    try {
      // Nota: githubTools.postComment es async
      githubTools.postComment({
        issue_number: this.issueNumber,
        body: text,
        repo: this.repo
      }).catch(e => console.error(`Failed to post comment: ${e.message}`));
    } catch (e) {
      console.error(`Error in displayMessage: ${e.message}`);
    }
  }

  displayThought(text) {
    console.log(`[THOUGHT] ${text}`);
  }

  displayInfo(message) {
    console.log(`[INFO] ${message}`);
  }

  displayError(message) {
    console.error(`[ERROR] ${message}`);
  }

  displayToolStatus(toolName, success, detail = '') {
    const status = success ? 'OK' : 'FAIL';
    console.log(`[TOOL] ${toolName} -> ${status} ${detail}`);
  }

  async getConfirmation(message) {
    console.log(`[CONFIRMATION REQUEST] ${message} -> Defaulting to True`);
    return true;
  }

  startToolMonitoring(toolName, detail = '') {}
  endToolMonitoring(toolName, success, detail = '') {}
  stopAllMonitoring() {}
  addSpacing() {}
  updateQueueCount(count) {}
}