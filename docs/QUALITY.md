# Quality Gates

Visionox-Whale uses two validation levels.

## Commit Gate

Run before committing source changes:

```powershell
npm run quality:check
```

This checks launcher, Dashboard and API bundle syntax, required local bundle patches,
all Node tests, a real Edge Dashboard render, Rust formatting, and diff whitespace. The
browser smoke test uses an isolated directory under `%TEMP%` and removes it afterward;
it never reads or changes the user's `~/.visionox` data. It does not build Rust and
cannot create `target/debug`.

The browser check requires Microsoft Edge, which is also a runtime prerequisite for the
Windows WebView application. Set `VISIONOX_EDGE_PATH` only when Edge is installed in a
non-standard location.

The repository CI runs the same command on Windows for pushes and pull requests.

## Release Gate

Run before delivering an executable or installer:

```powershell
npm run release:check
```

The release gate additionally runs isolated offline Rust tests, validates runtime paths,
builds the canonical release executable, and verifies generated resources. NSIS remains
an explicit separate operation through `npm run bundle:nsis`.

CI does not build release artifacts because the bundled Node and OfficeCLI executables
are intentionally not stored in Git. Release validation must run in the controlled
Windows build environment where those binaries are present.
