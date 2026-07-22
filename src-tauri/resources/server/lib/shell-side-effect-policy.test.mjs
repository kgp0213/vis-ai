import test from "node:test";
import assert from "node:assert/strict";
import { shellCommandArtifactPaths, shellCommandHasSideEffects } from "./shell-side-effect-policy.mjs";

test("inline scripts that write files are not classified as read-only", () => {
  assert.equal(shellCommandHasSideEffects(`py -c "open('result.md','w').write('x')"`), true);
  assert.equal(shellCommandHasSideEffects(`node -e "require('fs').writeFileSync('result.md','x')"`), true);
});

test("redirects and converters with an output path are mutating", () => {
  assert.equal(shellCommandHasSideEffects("tool input.txt > result.md"), true);
  assert.equal(shellCommandHasSideEffects('pdftotext -f 1 -l 10 "source.pdf" "result.md"'), true);
});

test("ordinary probes remain read-only", () => {
  assert.equal(shellCommandHasSideEffects("py --version"), false);
  assert.equal(shellCommandHasSideEffects('pdfinfo "source.pdf"'), false);
});

test("artifact paths are recovered from redirects and inline conversion scripts", () => {
  assert.deepEqual(shellCommandArtifactPaths("tool input.txt > result.md"), ["result.md"]);
  assert.deepEqual(shellCommandArtifactPaths(`py -c "out = r'C:\\work\\result.md'; open(out, 'w').write('x')"`), ["C:\\work\\result.md"]);
});
