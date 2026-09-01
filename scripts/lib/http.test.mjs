import { test } from "node:test";
import assert from "node:assert/strict";
import { requestJson, HttpError } from "./http.mjs";
import { fakeFetch } from "./test-helpers.mjs";

const noSleep = async () => {};

test("retries on 503 then returns parsed JSON", async () => {
  const fetchImpl = fakeFetch([{ status: 503, json: "x" }, { status: 503, json: "x" }, { json: { ok: 1 } }]);
  const out = await requestJson("https://x/y", { fetchImpl, sleep: noSleep });
  assert.deepEqual(out, { ok: 1 });
  assert.equal(fetchImpl.calls.length, 3);
});

test("does not retry 4xx and throws HttpError with status", async () => {
  const fetchImpl = fakeFetch([{ status: 404, json: "nope" }]);
  await assert.rejects(requestJson("https://x/y", { fetchImpl, sleep: noSleep }), (e) => e instanceof HttpError && e.status === 404);
  assert.equal(fetchImpl.calls.length, 1);
});

test("gives up after retries with a Norwegian message", async () => {
  const fetchImpl = fakeFetch([{ status: 500, json: 1 }, { status: 500, json: 1 }, { status: 500, json: 1 }, { status: 500, json: 1 }]);
  await assert.rejects(requestJson("https://x/y", { fetchImpl, sleep: noSleep }), /ga opp etter 4 forsøk/);
});

test("POST sends JSON body with content-type; strips BOM in response", async () => {
  const seen = [];
  const impl = async (url, init) => {
    seen.push(init);
    return { ok: true, status: 200, text: async () => "﻿" + JSON.stringify({ a: 1 }) };
  };
  const out = await requestJson("https://x/y", { method: "POST", body: { q: 1 }, fetchImpl: impl, sleep: noSleep });
  assert.deepEqual(out, { a: 1 });
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].headers["content-type"], "application/json");
  assert.equal(seen[0].body, '{"q":1}');
});
