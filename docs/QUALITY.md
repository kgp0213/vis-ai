# Quality Gates

Visionox-Whale uses two validation levels.

## Commit Gate

Run before committing source changes:

```powershell
npm run quality:check
```

This checks launcher, Dashboard and API bundle syntax, required local bundle patches,
all Node tests, Rust formatting, and diff whitespace. It does not build Rust and cannot
create `target/debug`.

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
