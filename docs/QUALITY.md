# Quality Gates

Visionox-Whale uses two validation levels.

## Commit Gate

Run before committing source changes:

```powershell
npm run quality:check
```

This checks launcher, Dashboard and API bundle syntax, product version consistency,
governed debug/release entrypoints, core API response schemas, test-file growth limits,
third-party runtime provenance, required local bundle patches, repository hygiene,
embedded runtime-secret scanning (hard-coded deployment endpoints and internal model identifiers),
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

Bootstrap skills additionally require complete directory coverage in
`src-tauri/resources/bootstrap-skills-provenance.json`. `verified` means the bundled files
or repository history establish both attribution and license; `partial` is an explicit
documentation gap and must never be presented as verified. New unregistered skill directories
fail the quality gate.

Scheduled execution changes must preserve the three existing task kinds and API status names.
Admission and cancellation policy require domain tests; restart recovery additionally requires
a round trip through the real versioned schedule store under `%TEMP%`.

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

## Test Organization

New behavior belongs in the nearest domain `*.test.mjs`. The two legacy aggregate suites have narrow roles:

- `api.test.mjs` keeps cross-endpoint integration and shared authentication flows.
- `dashboard-regression.test.mjs` keeps cross-panel workflows and historical bundle-patch baselines.

Storage, policy, contracts and isolated panel behavior should use focused test files. Do not raise the limits in
`scripts/check-test-structure.js` to accommodate unrelated tests; lower a limit only after existing cases move out.

When changing overview, health, backup, schedule or Provider responses, update
`contracts/api-responses.schema.json` and verify a real response, not only a mock. Independently expressible Dashboard
policy should live in readable support modules with unit tests; bundle regression verifies integration and Edge smoke
verifies the user flow.

Failure-path tests must match `runtime-issues.mjs`: debug is diagnostic, warning is recoverable degradation, error means
user data may be incomplete, and fatal stops an unsafe operation. Data-write tests must prove malformed or newer files
remain unchanged. Schedule admission, cancellation and restart recovery require domain tests; restart recovery must
round-trip through the real versioned store.

All test data belongs under the system temporary directory and must be cleaned on success and failure. Browser tests use
the isolated HOME/USERPROFILE created by `scripts/ui-smoke.js` and must never read the real `~/.visionox` directory.

## Real-model acceptance

Run the three-model matrix only after a clean release build:

```powershell
node scripts/real-task-acceptance.mjs          # redacted inventory only
node scripts/real-task-acceptance.mjs --execute
```

The executor copies the configured providers into an isolated `%TEMP%` home, uses a temporary
workspace, never prints credentials or service URLs, and removes the temporary tree when it exits.
It never performs DWS sends. DWS cases stay blocked until the user separately authorizes a self-chat
test; encrypted-file cases stay blocked until an approved encrypted fixture is available.

The 2026-07-24 baseline tested Doubao 2.0 Code, Kimi K2.7 Code and Qwen3.5-397B.
The user subsequently completed the manual checks and accepted the matrix as passed. Qwen requires
the designated network environment; `fetch failed` evidence captured outside that environment means
the provider was unreachable during that run, not that a code fix succeeded or failed. Doubao and Kimi
completed the artifact, cancellation, session isolation and retry cases without an intervention card.
The encrypted-file and DWS rows remain prerequisite-gated and are not represented as synthetic sends
or synthetic encrypted-file passes.
Raw redacted evidence is generated locally under `plan/real-task-acceptance-results-2026-07-24.*`;
the ignored `plan/` directory must not be force-added solely to publish machine-specific evidence.
