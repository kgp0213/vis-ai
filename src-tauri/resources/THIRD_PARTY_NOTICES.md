# Third-Party Resources

Visionox-Whale distributes third-party and internally supplied runtime components. Exact binary hashes are recorded in `runtime-manifest.json` and `third-party-resources.json`.

## Node.js Runtime

- Version: v25.2.1
- Purpose: embedded JavaScript runtime
- Source classification: locally supplied Node.js runtime
- License: Node.js project license

## OfficeCLI

- Version: 1.0.129
- Purpose: Office document automation
- Source classification: internally supplied binary
- License: internal distribution terms managed outside this repository

The repository records the exact binary size and SHA-256 but does not claim a public download URL.

## Reasonix

- Version: 260710
- Source: <https://github.com/esengine/reasonix>
- License: MIT, included at `server/visionox-pkg/LICENSE`

## KaTeX

- Distribution: vendored Dashboard runtime
- License: MIT, included at `server/visionox-pkg/dashboard/vendor/katex/LICENSE`

Package-level JavaScript dependency versions are locked by `server/visionox-pkg/package-lock.json`; their license files remain in the prepared runtime dependency tree.
