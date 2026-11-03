import { test, describe } from "node:test";
import assert from "node:assert";
import SmartToolParser from "../src/core/smartParser.js";

const parser = new SmartToolParser();

describe("SmartToolParser argument contract", () => {
  test("execute with no arguments reports a validation error instead of crashing", () => {
    const { data, error } = parser.parseCall("execute()");
    assert.strictEqual(data, null);
    assert.match(error, /^Validation:/);
  });

  test("execute maps a single positional argument to command", () => {
    const { data, error } = parser.parseCall('execute("ls")');
    assert.strictEqual(error, null);
    assert.deepStrictEqual(data, { name: "execute", args: { command: "ls" } });
  });

  test("surplus positional arguments are rejected, not silently dropped", () => {
    const { data, error } = parser.parseCall('execute("ls", "extra")');
    assert.strictEqual(data, null);
    assert.match(error, /accepts at most 1 arguments, got 2/);
  });

  test("schema defaults reach the caller through validated output", () => {
    const { data, error } = parser.parseCall("eslint()");
    assert.strictEqual(error, null);
    assert.deepStrictEqual(data.args, { path: "." });
  });

  test("validated args are rebuilt in declared key order", () => {
    const { data, error } = parser.parseCall('grep("needle", "src")');
    assert.strictEqual(error, null);
    assert.deepStrictEqual(Object.keys(data.args), ["query", "path"]);
    assert.deepStrictEqual(data.args, { query: "needle", path: "src" });
  });

  test("multiple statements in one call are rejected", () => {
    const { data, error } = parser.parseCall('read("a"); read("b")');
    assert.strictEqual(data, null);
    assert.match(error, /single tool call expression/);
  });

  test("unknown tools are reported by name", () => {
    const { data, error } = parser.parseCall('nope("x")');
    assert.strictEqual(data, null);
    assert.match(error, /Unknown tool: nope/);
  });

  test("object prototype properties cannot be invoked as tools", () => {
    ["constructor", "toString", "__proto__"].forEach((name) => {
      const result = parser.parseCall(`${name}()`);
      assert.strictEqual(result.data, null);
      assert.match(result.error, /Unknown tool/);
    });
  });

  test("bare identifiers still cast to strings", () => {
    const { data, error } = parser.parseCall("read(README.md)");
    assert.strictEqual(error, null);
    assert.deepStrictEqual(data.args, { path: "README.md" });
  });
});

describe("SmartToolParser positional invocation", () => {
  test("omitted optional middle parameters keep later arguments in place", () => {
    const args = {
      action: "inspect",
      filePath: "f.bin",
      offset: 0,
      endianness: "BE",
    };
    const positional = parser.buildPositionalArgs("bin", args);
    assert.deepStrictEqual(positional, [
      "inspect",
      "f.bin",
      0,
      undefined,
      undefined,
      "BE",
    ]);
  });

  test("trailing omitted optional parameters are not passed at all", () => {
    const positional = parser.buildPositionalArgs("tail", {
      path: "a.txt",
      tail: 5,
    });
    assert.deepStrictEqual(positional, ["a.txt", 5]);
  });

  test("positional order follows the registry, not the caller's key order", () => {
    const positional = parser.buildPositionalArgs("replace", {
      replace_text: "b",
      path: "a.txt",
      search_text: "a",
    });
    assert.deepStrictEqual(positional, ["a.txt", "a", "b"]);
  });

  test("non-registry names fall back to value order", () => {
    const positional = parser.buildPositionalArgs("not_a_tool", { a: 1, b: 2 });
    assert.deepStrictEqual(positional, [1, 2]);
  });
});

describe("SmartToolParser extraction and cleaning", () => {
  test("extractToolCalls finds a delimited call", () => {
    const calls = parser.extractToolCalls("intro \u018fread(\"a.txt\")\u0259 outro");
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].error, null);
    assert.deepStrictEqual(calls[0].data, {
      name: "read",
      args: { path: "a.txt" },
    });
  });

  test("cleanResponse strips delimiters and keeps surrounding text", () => {
    const cleaned = parser.cleanResponse("a \u018fread(\"x\")\u0259 b");
    assert.strictEqual(cleaned, "a  b");
  });

  test("cleanResponse is empty for empty input", () => {
    assert.strictEqual(parser.cleanResponse(""), "");
  });

  test("schwa is reserved inside tool arguments", () => {
    ['write("x", "aəb")', 'write("x", "aƏb")'].forEach((source) => {
      const result = parser.parseCall(source);
      assert.strictEqual(result.data, null);
      assert.match(result.error, /Schwa is reserved/);
      assert.strictEqual(parser.extractToolCalls(`Ə${source}`)[0].data, null);
    });
  });

  test("a single opening marker is enough and preserves surrounding prose", () => {
    const [call] = parser.extractToolCalls('intro Əread("a") outro');
    assert.strictEqual(call.error, null);
    assert.strictEqual(call.data.args.path, "a");
    assert.strictEqual(parser.cleanResponse('intro Əread("a") outro'), "intro  outro");
  });

  test("parentheses in quoted content do not end the call", () => {
    const [call] = parser.extractToolCalls('Əwrite("x", "a)b(c")');
    assert.strictEqual(call.error, null);
    assert.strictEqual(call.data.args.content, "a)b(c");
  });

  test("incomplete parentheses are rejected even without a closing marker", () => {
    const [call] = parser.extractToolCalls('Əread("a"');
    assert.strictEqual(call.data, null);
    assert.match(call.error, /Parse error/);
  });

  test("separate delimited calls are kept in order", () => {
    const calls = parser.extractToolCalls('Əread("a")ə text Əread("b")ə');
    assert.deepStrictEqual(calls.map((call) => call.data.args.path), ["a", "b"]);
  });

  test("a broken block does not consume the next tool call", () => {
    const calls = parser.extractToolCalls('Əread("a" Əread("b")ə');
    assert.strictEqual(calls[0].data, null);
    assert.strictEqual(calls[1].data.args.path, "b");
  });

  test("unsupported argument expressions are rejected", () => {
    // The interpolation below is deliberately input data for the parser.
    // eslint-disable-next-line no-template-curly-in-string
    const expressions = ['foo()', '...["a"]', '"a" + "b"', '{[key]: "x"}', '{...obj}', '`a${x}`'];
    expressions.forEach((expression) => {
      const result = parser.parseCall(`push(${expression})`);
      assert.strictEqual(result.data, null, expression);
      assert.match(result.error, /Unsupported/, expression);
    });
  });

  test("the next reserved opening marker starts a separate call", () => {
    const calls = parser.extractToolCalls('Əread("broken Əread("b")');
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[0].data, null);
    assert.strictEqual(calls[1].error, null);
    assert.strictEqual(calls[1].data.args.path, "b");
  });

  test("mixed calls with optional closing markers remain ordered", () => {
    const source = 'Əread("a") text Əread("b")ə text Əread("c")';
    const calls = parser.extractToolCalls(source);
    assert.deepStrictEqual(calls.map((call) => call.data.args.path), ["a", "b", "c"]);
    assert.strictEqual(parser.cleanResponse(source), " text  text ");
  });

  test("multiple statements and expression continuations are rejected without a closing marker", () => {
    ['read("a"); read("b")', 'read("a")\nread("b")', 'read("a")?.x', 'read("a"))'].forEach((source) => {
      assert.strictEqual(parser.extractToolCalls(`Ə${source}`)[0].data, null, source);
    });
  });

  test("literal objects, arrays and signed numbers preserve their values", () => {
    const result = parser.parseCall('update("x.json", "value", {a: [-2, +3, true, null]})');
    assert.strictEqual(result.error, null);
    assert.deepStrictEqual(result.data.args.value, { a: [-2, 3, true, null] });
  });
});
