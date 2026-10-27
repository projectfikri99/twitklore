import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimitDelay } from "./backoff.ts";

test("backoff naik linear sesuai rumus 2*attempt*base + base", () => {
  assert.equal(rateLimitDelay(0), 60_000);
  assert.equal(rateLimitDelay(1), 180_000);
  assert.equal(rateLimitDelay(2), 300_000);
});

test("backoff cap di 10 menit", () => {
  assert.equal(rateLimitDelay(100), 600_000);
});
