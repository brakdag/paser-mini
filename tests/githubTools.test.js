import { test } from "node:test";
import assert from "node:assert/strict";
import GithubTools from "../src/tools/githubTools.js";

["issues", "comments"].forEach((resource) => {
  test(`GitHub ${resource} lists every page using a fixed resource URL`, async (t) => {
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "offline-token";
    t.after(() => { if (previous === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = previous; });
    const calls = [];
    const tool = new GithubTools({
      client: {
        async get(url, options) {
          calls.push([url, options.params]);
          return options.params.page === 1
            ? { data: [{ id: 1 }], headers: { link: '<https://api.github.com/next>; rel="next"' } }
            : { data: [{ id: 2 }], headers: {} };
        },
      },
    });
    const result = resource === "issues" ? await tool.listIssues("owner/repo") : await tool.getIssueComments(7, "owner/repo");
    assert.deepEqual(result, [{ id: 1 }, { id: 2 }]);
    assert.deepEqual(calls.map((entry) => entry[1].page), [1, 2]);
    assert.ok(calls.every((entry) => entry[1].per_page === 100));
    assert.equal(calls[0][0], calls[1][0]);
    assert.equal(calls[0][0], `/repos/owner/repo/issues${resource === "comments" ? "/7/comments" : ""}`);
    if (resource === "issues") assert.equal(calls[0][1].state, "open");
  });
});

test("GitHub pagination also handles full pages without Link headers", async (t) => {
  const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "offline-token";
    t.after(() => { if (previous === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = previous; });
  const tool = new GithubTools({ client: {
    async get(_url, { params }) {
      return { data: params.page === 1 ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: 100 }] };
    },
  } });
  assert.equal((await tool.listIssues("owner/repo")).length, 101);
});

test("GitHub pagination refuses malformed and unbounded responses", async (t) => {
  const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "offline-token";
    t.after(() => { if (previous === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = previous; });
  const invalid = new GithubTools({ client: { async get() { return { data: {} }; } } });
  await assert.rejects(invalid.listIssues("owner/repo"), /Invalid GitHub list response/);
  let calls = 0;
  const endless = new GithubTools({ client: {
    async get() { calls += 1; return { data: [], headers: { link: '<next>; rel="next"' } }; },
  } });
  await assert.rejects(endless.getIssueComments(1, "owner/repo"), /exceeded 1000 pages/);
  assert.equal(calls, 1000);
});
