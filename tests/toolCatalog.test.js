import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import TOOL_DEFINITIONS from "../src/infrastructure/toolDefinitions.js";
import { AVAILABLE_TOOLS, createTools, generateSystemInstruction } from "../src/infrastructure/registry.js";
import SmartToolParser from "../src/core/smartParser.js";
import ExecutionEngine from "../src/core/executionEngine.js";
import BinaryTools from "../src/tools/binaryTools.js";
import FileTools from "../src/tools/fileTools.js";
import { SystemTools } from "../src/tools/systemTools.js";

const values = {
  path: "fixture.txt", filePath: "fixture.bin", filepath: "fixture.txt", file_path: "fixture.json",
  action: "inspect", offset: 0, length: 8, end: 8, endianness: "BE", outputFile: "out.bin",
  pattern: "01 02", hexString: "01 02", type: "UInt16", issue_number: 1, crop: [0, 0, 1, 1],
  limit: 10, tail: 5, headers: "{}", url: "example.test", value: { hello: [1, true] },
};

/**
 * Constructs an engine with a silent UI and the supplied executable registry.
 * @param {object} tools - Executable tool wrappers.
 * @returns {{parser: SmartToolParser, engine: ExecutionEngine}} Test pipeline.
 */
function pipeline(tools) {
  const parser = new SmartToolParser();
  const ui = { bashEnabled: true, startToolMonitoring() {}, endToolMonitoring() {} };
  return { parser, engine: new ExecutionEngine({}, tools, parser, ui) };
}

describe("shared tool catalog contracts", () => {
  test("all executable tools are described, parseable, validatable and invocable", async () => {
    const calls = [];
    const instances = {};
    Object.values(TOOL_DEFINITIONS).forEach((definition) => {
      if (!definition.moduleKey) return;
      instances[definition.moduleKey] ||= {};
      /**
       * Records calls without running tool side effects.
       * @param {...unknown} args - Implementation arguments.
       * @returns {Promise<string>} Success marker.
       */
      instances[definition.moduleKey][definition.method] = async (...args) => {
        calls.push({ moduleKey: definition.moduleKey, method: definition.method, args });
        return "ok";
      };
    });
    const tools = createTools(async (moduleKey) => instances[moduleKey]);
    const { parser, engine } = pipeline(tools);
    assert.deepEqual(Object.keys(AVAILABLE_TOOLS), Object.keys(TOOL_DEFINITIONS));
    const prompt = generateSystemInstruction(Object.keys(tools));
    const entries = Object.entries(TOOL_DEFINITIONS);
    for (let i = 0; i < entries.length; i += 1) {
      const [name, definition] = entries[i];
      if (!definition.requiresBash) assert.ok(prompt.includes(`${name}(`), name);
      const args = definition.parameters.map((key) => JSON.stringify(values[key] ?? "value"));
      const [{ data, error }] = parser.extractToolCalls(`Ə${name}(${args.join(",")})ə`);
      assert.equal(error, null, name);
      const result = await engine.executeToolCall(data.name, data.args);
      assert.equal(result.success, true, `${name}: ${result.result}`);
      if (definition.moduleKey) assert.equal(calls.at(-1).method, definition.method, name);
    }
  });

  test("each catalog target names a real implementation method", async () => {
    const entries = Object.entries(TOOL_DEFINITIONS);
    for (let i = 0; i < entries.length; i += 1) {
      const [name, definition] = entries[i];
      if (definition.moduleKey) {
        const module = await import(`../src/tools/${definition.moduleKey}.js`);
        const implementations = Object.values(module).filter((value) => typeof value === "function");
        assert.ok(implementations.some((implementation) => typeof implementation.prototype?.[definition.method] === "function"), name);
      }
    }
  });

  test("binary conversion reaches the real options signature with argument holes intact", async () => {
    const binary = new BinaryTools();
    const { parser, engine } = pipeline(createTools(async () => binary));
    const raw = 'Əbin("convert",undefined,undefined,undefined,undefined,"BE",undefined,undefined,"01 02","UInt16")ə';
    const [{ data, error }] = parser.extractToolCalls(raw);
    assert.equal(error, null);
    const result = await engine.executeToolCall(data.name, data.args);
    assert.equal(result.success, true);
    assert.equal(result.result, 258);
  });

  test("binary actions require their own fields before invocation", () => {
    const parser = new SmartToolParser();
    ['bin("search","f.bin")', 'bin("extract","f.bin")', 'bin("convert")'].forEach((raw) => {
      const result = parser.parseCall(raw);
      assert.equal(result.data, null, raw);
      assert.match(result.error, /^Validation:/);
    });
  });

  test("mkdir, concat and binary extraction work through their real registry signatures", async () => {
    const directory = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-catalog-"));
    const fileTools = new FileTools();
    const binaryTools = new BinaryTools();
    const { parser, engine } = pipeline(createTools(async (moduleKey) => (
      moduleKey === "fileTools" ? fileTools : binaryTools
    )));
    try {
      const source = path.join(directory, "source.txt");
      const destination = path.join(directory, "destination.txt");
      const output = path.join(directory, "output.bin");
      const nested = path.join(directory, "nested");
      await fs.writeFile(source, "source bytes");
      await fs.writeFile(destination, "prefix ");
      const calls = [
        `mkdir(${JSON.stringify(nested)})`,
        `concat(${JSON.stringify(destination)},${JSON.stringify(source)})`,
        `bin("extract",${JSON.stringify(source)},1,undefined,4,"BE",${JSON.stringify(output)})`,
      ];
      for (let i = 0; i < calls.length; i += 1) {
        const [{ data, error }] = parser.extractToolCalls(`Ə${calls[i]}ə`);
        assert.equal(error, null);
        const result = await engine.executeToolCall(data.name, data.args);
        assert.equal(result.success, true, result.result);
      }
      assert.ok((await fs.stat(nested)).isDirectory());
      assert.equal(await fs.readFile(destination, "utf8"), "prefix source bytes");
      assert.equal(await fs.readFile(source, "utf8"), "source bytes");
      assert.equal(await fs.readFile(output, "utf8"), "our");
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  test("schema reload invokes the real implementation without external effects", async () => {
    const { parser, engine } = pipeline(createTools(async () => new SystemTools()));
    const { data, error } = parser.parseCall("reloadSchemas()");
    assert.equal(error, null);
    const result = await engine.executeToolCall(data.name, data.args);
    assert.equal(result.success, true);
    assert.match(result.result, /re-registered/);
    assert.equal(parser.parseCall("eslint()").data.args.path, ".");
  });

  test("empty filesystem paths fail validation", () => {
    const parser = new SmartToolParser();
    ['read("")', 'eslint("")', 'mkdir("")', 'doc("")', 'concat("destination", "")'].forEach((raw) => {
      const result = parser.parseCall(raw);
      assert.equal(result.data, null, raw);
      assert.match(result.error, /^Validation:/);
    });
  });
});
