import test from "node:test";
import assert from "node:assert/strict";

import { formatArtifactReference, parseArtifactReference } from "./artifact-reference.mjs";

test("artifact references round-trip exact manifests and normalize hashes", () => {
  const sha256 = "A".repeat(64);
  const reference = formatArtifactReference({ artifactId: "report", revision: 3, sha256 });
  assert.equal(reference, `report@r3#${sha256.toLowerCase()}`);
  assert.deepEqual(parseArtifactReference(reference), {
    raw: reference,
    artifactId: "report",
    revision: 3,
    sha256: sha256.toLowerCase(),
    exact: true,
  });
});

test("artifact references preserve legacy values and reject invalid manifests", () => {
  assert.deepEqual(parseArtifactReference("report.md"), {
    raw: "report.md",
    artifactId: "report.md",
    revision: null,
    sha256: null,
    exact: false,
  });
  assert.throws(() => formatArtifactReference({ artifactId: "", revision: 1, sha256: "0".repeat(64) }), /exact reference/);
  assert.throws(() => formatArtifactReference({ artifactId: "report", revision: 0, sha256: "0".repeat(64) }), /exact reference/);
  assert.throws(() => formatArtifactReference({ artifactId: "report", revision: 1, sha256: "invalid" }), /exact reference/);
});
