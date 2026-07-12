import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assertApiContract, validateSchema } from "../../../../scripts/check-api-contracts.js";

const contracts = JSON.parse(readFileSync(new URL("../../../../contracts/api-responses.schema.json", import.meta.url), "utf8"));

test("API response contracts are valid and reject missing required fields", () => {
  assert.doesNotThrow(() => assertApiContract(contracts, "backups", { items: [{ id: "one", status: "ok" }] }));
  assert.throws(() => assertApiContract(contracts, "backups", { items: [{ id: "one" }] }), /status is required/);
  assert.throws(() => assertApiContract(contracts, "missing", {}), /unknown API contract/);
});

test("schema validator checks nested types, arrays and enums", () => {
  const schema = { type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "integer", enum: [1, 2] } } } };
  assert.deepEqual(validateSchema({ items: [1, 2] }, schema), []);
  assert.ok(validateSchema({ items: [3, "bad"] }, schema).length >= 2);
});
