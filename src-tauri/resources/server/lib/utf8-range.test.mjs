import test from "node:test";
import assert from "node:assert/strict";

import { utf8SafePrefixLength } from "./utf8-range.mjs";

test("UTF-8 byte ranges end only at complete code-point boundaries", () => {
  const source = Buffer.from("前缀😀中间\n尾部", "utf8");
  for (let limit = 1; limit <= source.length; limit += 1) {
    const length = utf8SafePrefixLength(source, limit);
    const decoded = source.subarray(0, length).toString("utf8");
    assert.doesNotMatch(decoded, /�/);
    assert.ok(length >= 1);
    assert.ok(length >= limit || length <= limit + 3);
  }
});

test("a range smaller than one code point still makes progress", () => {
  const emoji = Buffer.from("😀", "utf8");
  assert.equal(utf8SafePrefixLength(emoji, 1), 4);
  assert.equal(utf8SafePrefixLength(emoji, 2), 4);
  assert.equal(utf8SafePrefixLength(emoji, 3), 4);
});

