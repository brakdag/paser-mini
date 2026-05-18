import { describe, it } from "node:test";
import assert from "node:assert";
import { NotificationTools } from "../src/tools/notificationTools.js";

const notificationTools = new NotificationTools();

describe("notificationTools", () => {
  it("should return OK", async () => {
    const result = await notificationTools.notifyUser({ message: "test" });
    assert.strictEqual(result, "OK");
  });
});
