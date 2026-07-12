# Quality Gates

Visionox-Whale uses two validation levels.

## Commit Gate

Run before committing source changes:

```powershell
npm run quality:check
```

This checks launcher, Dashboard and API bundle syntax, product version consistency,
disabled debug entrypoints, core API response schemas, test-file growth limits,
third-party runtime provenance, required local bundle patches, repository hygiene,
all Node tests, a real Edge Dashboard render, Rust formatting, and diff whitespace.
Project-owned runtime modules under `resources/server/lib/` must retain
at least 90% line coverage, 60% branch coverage and 90% function coverage; vendored
Dashboard and API bundles are excluded from this metric. The hygiene check rejects `.map`, `.bak`, `.old` and redundant `.zip`
files outside package-manager dependencies; the explicitly documented offline Poppler
archive is the only exception. The
browser smoke test uses an isolated directory under `%TEMP%` and removes it afterward;
it never reads or changes the user's `~/.visionox` data. It does not build Rust and
cannot create `target/debug`.

The browser check requires Microsoft Edge, which is also a runtime prerequisite for the
Windows WebView application. Set `VISIONOX_EDGE_PATH` only when Edge is installed in a
non-standard location.

The repository CI runs the same command on Windows for pushes and pull requests.
CI and local formatting use Rust 1.94.0 from `rust-toolchain.toml`; toolchain drift is not
accepted as an implicit source change.

## Definition Of Done

A source change is complete only when all applicable items below are true:

1. The requested behavior has a focused regression test, or the reason automation is impractical is recorded.
2. User-data format changes preserve existing files, use a schema version when the structure can evolve, and replace critical files atomically.
3. Dashboard behavior passes the relevant checks in [Dashboard parity](DASHBOARD_PARITY.md); high-frequency interaction changes also pass the real Edge smoke test.
4. User-facing behavior, build instructions and resource requirements are reflected in the maintained documentation without duplicating stale guidance.
5. `npm run quality:check` passes from a clean process state and leaves no repository or `%TEMP%` residue.
6. Packaged third-party resources agree with `src-tauri/resources/third-party-resources.json` and their notices are present.

Building an executable is not part of the normal commit gate. Build only when the requested deliverable requires it, using the release gate below.

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

Use [Release acceptance checklist](RELEASE_CHECKLIST.md) for every executable or installer
delivery. Keep the completed checklist and SHA-256 record with the release notes; do not
tag or publish until the recorded commit, version, artifact names and hashes agree.
