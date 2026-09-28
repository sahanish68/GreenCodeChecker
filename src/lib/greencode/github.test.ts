import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_ANALYSIS } from "./demo";
import { parseRepoUrl } from "./github";

test("parses canonical repository URLs and encoded branch names", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/vercel/next.js"), {
    owner: "vercel",
    name: "next.js",
    branch: null,
  });
  assert.deepEqual(parseRepoUrl("https://github.com/acme/app.git/tree/feature%2Fbranch"), {
    owner: "acme",
    name: "app",
    branch: "feature/branch",
  });
});

test("rejects non-GitHub and malformed repository URLs", () => {
  for (const url of [
    "not a URL",
    "https://evil.com/github.com/acme/app",
    "http://github.com/acme/app",
    "https://github.com/acme%2Fother/app",
    "https://github.com/acme/app%2Fother",
    "https://github.com/acme/app/issues",
    "https://github.com/acme/%E0%A4%A",
  ]) {
    assert.throws(() => parseRepoUrl(url), /full public GitHub repository URL/);
  }
});

test("demo results stay labeled as non-live and include exactly three recommendations", () => {
  assert.equal(DEMO_ANALYSIS.id, "demo");
  assert.equal(DEMO_ANALYSIS.carbon.intensityIsLive, false);
  assert.match(DEMO_ANALYSIS.carbon.intensitySource, /Demo dataset/);
  assert.equal(DEMO_ANALYSIS.recommendations.length, 3);
});