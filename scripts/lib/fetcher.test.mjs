import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFetcher } from "./fetcher.mjs";

test("runFetcher writes raw json and one csv per transform key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kap-"));
  const def = {
    meta: { id: "test_1", navn: "Test", url: "https://x", api_url: "https://x/api", lisens: "NLOD" },
    fetchRaw: async (deps) => ({ hello: deps.today }),
    transform: (raw) => ({ "a.csv": [{ k: "v", n: 1 }] }),
    columns: { "a.csv": ["k", "n"] },
  };
  const result = await runFetcher(def, { deps: { today: "2026-09-02" }, log: () => {}, rawDir: dir, outDir: dir });
  assert.deepEqual(result, { id: "test_1", tables: ["a.csv"], rows: { "a.csv": 1 } });
  assert.deepEqual(JSON.parse(await readFile(join(dir, "test_1.json"), "utf8")), { hello: "2026-09-02" });
  assert.equal(await readFile(join(dir, "a.csv"), "utf8"), "k,n\nv,1\n");
});

test("runFetcher refuses a table without a column list or with zero rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kap-"));
  const base = { meta: { id: "t" }, fetchRaw: async () => ({}), columns: {} };
  await assert.rejects(
    runFetcher({ ...base, transform: () => ({ "b.csv": [{ x: 1 }] }) }, { deps: {}, log: () => {}, rawDir: dir, outDir: dir }),
    /kolonneliste/,
  );
  await assert.rejects(
    runFetcher({ ...base, columns: { "b.csv": ["x"] }, transform: () => ({ "b.csv": [] }) }, { deps: {}, log: () => {}, rawDir: dir, outDir: dir }),
    /0 rader/,
  );
});
