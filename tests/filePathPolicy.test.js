import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import JSZip from "jszip";
import { AstTools } from "../src/tools/astTools.js";
import ZipTools from "../src/tools/zipTools.js";
import InspectTools from "../src/tools/inspectTools.js";
import UtilTools from "../src/tools/utilTools.js";

/**
 * Creates an inspector without starting Node or opening a debug port.
 * @param {Array} calls - Captured process launches.
 * @returns {InspectTools} Inspector with a simulated child process.
 */
function makeInspector(calls) {
  return new InspectTools({
    spawnProcess(executable, args) {
      calls.push({ executable, args });
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      /**
       * Marks the simulated process as terminated.
       * @returns {boolean} Successful termination.
       */
      child.kill = () => { child.killed = true; return true; };
      queueMicrotask(() => child.stdout.emit("data", Buffer.from("debug> ")));
      return child;
    },
  });
}

/**
 * Simulates ImageMagick and records its inputs and temporary outputs.
 * @param {Array} calls - Captured command invocations.
 * @returns {UtilTools} Utilities with no external commands.
 */
function makeImageTools(calls) {
  return new UtilTools({
    async executor(executable, args) {
      calls.push({ executable, args });
      if (executable === "convert") {
        await fs.writeFile(args.at(-1), "jpeg fixture");
      }
      return { stdout: "20x10\n" };
    },
  });
}

describe("file tools share the project path policy", () => {
  let fixtureDir;
  let externalDir;

  before(async () => {
    fixtureDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-policy-"));
    externalDir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-policy-external-"));
    const zip = new JSZip();
    zip.file("hello.txt", "hello");
    const archive = await zip.generateAsync({ type: "nodebuffer" });
    await Promise.all([fixtureDir, externalDir].map(async (dir) => {
      await fs.writeFile(path.join(dir, "sample.js"), "const value = 42;");
      await fs.writeFile(path.join(dir, "sample.zip"), archive);
      await fs.writeFile(path.join(dir, "sample.png"), "image fixture");
      await fs.mkdir(path.join(dir, "deep"));
    }));
    await fs.symlink(fixtureDir, path.join(fixtureDir, "internal"), "dir");
    await fs.symlink(externalDir, path.join(fixtureDir, "external"), "dir");
    await fs.symlink(path.join(externalDir, "deep"), path.join(fixtureDir, "bridge"), "dir");
    await fs.symlink(path.join(externalDir, "missing"), path.join(fixtureDir, "dangling"), "dir");
  });

  after(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(externalDir, { recursive: true, force: true });
  });

  const operations = [
    {
      name: "AST", filename: "sample.js",
      async run(input) {
        const result = JSON.parse(await new AstTools().analyze(input, "Identifier"));
        assert.deepEqual(result.results, [{ type: "Identifier", name: "value" }]);
      },
    },
    {
      name: "ZIP", filename: "sample.zip",
      async run(input) {
        const result = JSON.parse(await new ZipTools().listContents(input));
        assert.deepEqual(result.files, ["hello.txt"]);
      },
    },
    {
      name: "image", filename: "sample.png",
      async run(input) {
        const calls = [];
        const result = await makeImageTools(calls).seeImage(input);
        assert.deepEqual(result, {
          mime_type: "image/jpeg", data: Buffer.from("jpeg fixture").toString("base64"), resolution: "20x10",
        });
        assert.equal(calls.length, 2);
        assert.ok(path.isAbsolute(calls[0].args.at(-2)));
        assert.equal(calls[1].args.at(-1), calls[0].args.at(-2));
        await assert.rejects(fs.access(path.dirname(calls[0].args.at(-1))), { code: "ENOENT" });
      },
    },
    {
      name: "inspector", filename: "sample.js",
      async run(input) {
        const calls = [];
        const inspector = makeInspector(calls);
        try {
          assert.equal(await inspector.inspect(input), "Inspect session started.");
          assert.equal(calls.length, 1);
          assert.equal(calls[0].executable, "node");
          assert.equal(calls[0].args[0], "inspect");
          assert.ok(path.isAbsolute(calls[0].args[1]));
        } finally {
          if (calls.length) await inspector.inspect("exit");
        }
      },
    },
  ];

  operations.forEach(({ name, filename, run }) => {
    it(`${name} accepts local paths and internal symlinks`, async () => {
      await run(path.relative(process.cwd(), path.join(fixtureDir, filename)));
      await run(path.join(fixtureDir, "internal", filename));
    });

    it(`${name} rejects external paths, escaping links and dangling links`, async () => {
      const inputs = [
        path.join(externalDir, filename),
        path.relative(process.cwd(), path.join(externalDir, filename)),
        path.join(fixtureDir, "external", filename),
        `${fixtureDir}/bridge/../${filename}`,
        path.join(fixtureDir, "dangling", filename),
      ];
      await Promise.all(inputs.map((input) => assert.rejects(run(input), /outside of project root/)));
    });
  });

  it("rejects image and inspector paths before launching external commands", async () => {
    const calls = [];
    const image = makeImageTools(calls);
    const inspector = makeInspector(calls);
    await assert.rejects(image.seeImage(path.join(externalDir, "sample.png")), /outside of project root/);
    await assert.rejects(inspector.inspect(path.join(externalDir, "sample.js")), /outside of project root/);
    assert.deepEqual(calls, []);
  });

  it("cleans image temporaries on conversion failure", async () => {
    let tempFile;
    const image = new UtilTools({
      async executor(_executable, args) {
        tempFile = args.at(-1);
        await fs.writeFile(tempFile, "partial output");
        throw new Error("conversion failed");
      },
    });
    await assert.rejects(image.seeImage(path.join(fixtureDir, "sample.png")), /Vision Tool Error: conversion failed/);
    await assert.rejects(fs.access(path.dirname(tempFile)), { code: "ENOENT" });
  });

  it("uses distinct image temporaries for concurrent conversions", async () => {
    const calls = [];
    const image = makeImageTools(calls);
    await Promise.all(Array.from({ length: 4 }, () => image.seeImage(path.join(fixtureDir, "sample.png"))));
    const outputs = calls.filter((call) => call.executable === "convert").map((call) => call.args.at(-1));
    assert.equal(new Set(outputs).size, 4);
    await Promise.all(outputs.map((output) => assert.rejects(fs.access(path.dirname(output)), { code: "ENOENT" })));
  });
});
