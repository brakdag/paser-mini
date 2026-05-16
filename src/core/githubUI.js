import * as githubTools from "../tools/githubTools";

class GitHubUI {
  constructor(issueNumber, repo = null) {
    this.issueNumber = issueNumber;
    this.repo = repo;
  }

  // eslint-disable-next-line no-unused-vars
  async requestInput(_prompt) {
    // In GitHub mode, input is managed by the orchestrator via message queue
    return "";
  }

  displayMessage(text) {
    console.log(`[POSTING TO GITHUB] Issue #${this.issueNumber}: ${text}`);
    try {
      // Nota: githubTools.postComment es async
      githubTools
        .postComment({
          issue_number: this.issueNumber,
          body: text,
          repo: this.repo,
        })
        .catch((e) => console.error(`Failed to post comment: ${e.message}`));
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

  displayToolStatus(toolName, success, detail = "") {
    const status = success ? "OK" : "FAIL";
    console.log(`[TOOL] ${toolName} -> ${status} ${detail}`);
  }

  async getConfirmation(message) {
    console.log(`[CONFIRMATION REQUEST] ${message} -> Defaulting to True`);
    return true;
  }

  // eslint-disable-next-line no-unused-vars
  startToolMonitoring(_toolName, _detail = "") {}

  // eslint-disable-next-line no-unused-vars
  endToolMonitoring(_toolName, _success) {}

  stopAllMonitoring() {}

  addSpacing() {}

  updateQueueCount() {}
}


export default GitHubUI;
