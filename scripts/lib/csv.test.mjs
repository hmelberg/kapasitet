import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, parseCsv } from "./csv.mjs";

test("toCsv quotes commas, quotes and newlines, and writes empty for null", () => {
  const csv = toCsv([{ a: 'x,y', b: 'he said "hi"', c: null }, { a: "plain", b: 1.5, c: "line\nbreak" }], ["a", "b", "c"]);
  assert.equal(csv, 'a,b,c\n"x,y","he said ""hi""",\nplain,1.5,"line\nbreak"\n');
});

test("parseCsv strips BOM, handles quoted fields and CRLF, returns objects", () => {
  const { columns, rows } = parseCsv('﻿a,b\r\n"x,y",2\r\nplain,"q""q"\r\n');
  assert.deepEqual(columns, ["a", "b"]);
  assert.deepEqual(rows, [{ a: "x,y", b: "2" }, { a: "plain", b: 'q"q' }]);
});

test("round trip", () => {
  const rows = [{ k: "æøå", v: "a,b" }];
  assert.deepEqual(parseCsv(toCsv(rows, ["k", "v"])).rows, rows);
});
