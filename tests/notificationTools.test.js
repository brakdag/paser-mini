import { describe, it } from "node:test";
import assert from "node:assert";
import NotificationTools from "../src/tools/notificationTools.js";

describe("notificationTools", () => {
  it("should issue the sound command without spawning a process", async () => {
    const commands = [];
    /**
     * Records the issued command instead of spawning an audio process.
     * @param {string} cmd - Command that would have run.
     * @returns {Promise<{stdout: string, stderr: string}>} Stub result.
     */
    const executor = async (cmd) => {
      commands.push(cmd);
      return { stdout: "", stderr: "" };
    };
    const notificationTools = new NotificationTools({ executor });

    await notificationTools.notifyUser("test");

    assert.strictEqual(commands.length, 1, "exactly one command is issued");
    assert.match(commands[0], /aplay/);
    assert.match(commands[0], /type\.wav/);
  });

  it("should propagate executor failures", async () => {
    /**
     * Fails the way a missing audio device would.
     * @returns {Promise<never>} Always rejects.
     */
    const executor = async () => {
      throw new Error("no audio device");
    };
    const notificationTools = new NotificationTools({ executor });

    await assert.rejects(
      () => notificationTools.notifyUser("test"),
      /no audio device/,
    );
  });
});
