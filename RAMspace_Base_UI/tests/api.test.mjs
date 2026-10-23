import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("components API exposes expected operations and validation", async () => {
  const source = await readFile(new URL("../app/api/components/route.ts", import.meta.url), "utf8");
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.match(source, /export async function DELETE/);
  assert.match(source, /status: 400/);
});
