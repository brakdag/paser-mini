import * as githubTools from "../tools/githubTools.js";

class GitHubUI {
  constructor(issueNumber, repo = null) {
    this.issueNumber = issueNumber;
    this.repo = repo;
  }

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
    console.log(`[THOUGHT] [Issue ${this.issueNumber}] ${text}`);
  }

  displayInfo(message) {
    console.log(`[INFO] [Issue ${this.issueNumber}] ${message}`);
  }

  displayError(message) {
    console.error(`[ERROR] [Issue ${this.issueNumber}] ${message}`);
  }

  displayToolStatus(toolName, success, detail = "") {
    const status = success ? "OK" : "FAIL";
    console.log(
      `[TOOL] [Issue ${this.issueNumber}] ${toolName} -> ${status} ${detail}`,
    );
  }

  async getConfirmation(message) {
    console.log(
      `[CONFIRMATION REQUEST] [Issue ${this.issueNumber}] ${message} -> Defaulting to True`,
    );
    return true;
  }

  startToolMonitoring(toolName, detail = "") {
    console.log(
      `[MONITORING START] [Issue ${this.issueNumber}] ${toolName} -> ${detail}`,
    );
  }

  endToolMonitoring(toolName, success) {
    const status = success ? "OK" : "FAIL";
    console.log(
      `[MONITORING END] [Issue ${this.issueNumber}] ${toolName} -> ${status}`,
    );
  }

  stopAllMonitoring() {
    console.log(`[MONITORING STOPPED] [Issue ${this.issueNumber}]`);
  }

  addSpacing() {
    console.log(`[SPACING] [Issue ${this.issueNumber}]`);
  }

  updateQueueCount() {
    console.log(`[QUEUE UPDATE] [Issue ${this.issueNumber}]`);
  }
}

export default GitHubUI;
