import test from "node:test";
import assert from "node:assert/strict";

import { isKnownLegacyBootstrapSkill } from "./bootstrap-skill-ownership.mjs";

test("only an exact known unmarked bootstrap Skill can be adopted", () => {
  assert.equal(isKnownLegacyBootstrapSkill("pdf", "d587374b670b85430785212e4fa19304949ce510e253208d0014763d2fb3e681"), true);
  assert.equal(isKnownLegacyBootstrapSkill("pdf", "changed-by-user"), false);
  assert.equal(isKnownLegacyBootstrapSkill("custom-pdf", "d587374b670b85430785212e4fa19304949ce510e253208d0014763d2fb3e681"), false);
});
