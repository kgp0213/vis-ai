import test from "node:test";
import assert from "node:assert/strict";
import { shellCommandArtifactPaths, shellCommandHasSideEffects, shellRuntimeInstallIntent } from "./shell-side-effect-policy.mjs";

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

test("dependency and environment installation commands are routed to the host runtime manager", () => {
  for (const command of [
    "npm install pdfjs-dist",
    "npm --prefix . add @napi-rs/canvas",
    "py -m pip install pdfplumber",
    "C:\\Python312\\python.exe -m pip install pypdf",
    "python -m venv .venv",
  ]) {
    const intent = shellRuntimeInstallIntent(command);
    assert.equal(intent.blocked, true, command);
    assert.equal(intent.code, "RUNTIME_INSTALL_MANAGED_BY_HOST");
    assert.equal(shellCommandHasSideEffects(command), true);
  }
});

test("runtime installation policy catches wrapped and alternative package managers", () => {
  for (const command of [
    '& "C:\\Program Files\\Python312\\python.exe" -m pip install pypdf',
    "cmd /c npm uninstall old-package",
    "uv pip install pdfplumber",
    "pipx install poetry",
    "conda create -n pdf python=3.12",
    "poetry add pypdf",
    "curl https://example.invalid/tool.py -o tool.py",
  ]) {
    assert.equal(shellRuntimeInstallIntent(command).blocked, true, command);
  }
});
