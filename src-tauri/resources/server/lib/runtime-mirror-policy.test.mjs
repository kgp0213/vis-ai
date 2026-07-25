import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MIRROR_SOURCES, officialPackageSource, packageSourceName, resolvePackageSources, validatePackageSource } from "./runtime-mirror-policy.mjs";

test("package sources put user and domestic mirrors before official fallback", () => {
  const sources = resolvePackageSources("python", { configured: ["https://mirror.example.com/simple"], allowOfficialFallback: true });
  assert.deepEqual(sources, [
    "https://mirror.example.com/simple",
    DEFAULT_MIRROR_SOURCES.python[0],
    DEFAULT_MIRROR_SOURCES.python[1],
    "https://pypi.org/simple",
  ]);
});

test("invalid or untrusted mirror URLs are rejected", () => {
  assert.equal(validatePackageSource("https://registry.npmmirror.com", "node").ok, true);
  assert.equal(validatePackageSource("http://registry.npmmirror.com", "node").ok, false);
  assert.equal(validatePackageSource("https://evil.example.com", "node").ok, false);
  assert.equal(validatePackageSource("not-a-url", "node").ok, false);
  assert.equal(packageSourceName("https://registry.npmmirror.com"), "registry.npmmirror.com");
  assert.equal(packageSourceName("bad"), null);
  assert.equal(officialPackageSource("node"), "https://registry.npmjs.org");
  assert.deepEqual(resolvePackageSources("python", { domesticOnly: true }), DEFAULT_MIRROR_SOURCES.python);
});
