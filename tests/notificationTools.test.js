import { describe, it } from "node:test";
import assert from "node:assert";
import NotificationTools from "../src/tools/notificationTools.js";

const notificationTools = new NotificationTools();

describe("notificationTools", () => {
  it("should notify without error", async () => {
    await notificationTools.notifyUser("test");
    assert.ok(true);
  });
});
