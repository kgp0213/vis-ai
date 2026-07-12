# Third-Party Resources

Visionox-Whale distributes third-party runtime components. Exact binary hashes are recorded in `runtime-manifest.json` and `third-party-resources.json`.

## Node.js Runtime

- Version: v25.2.1
- Purpose: embedded JavaScript runtime
- Source: <https://github.com/nodejs/node>
- License: MIT

## OfficeCLI

- Version: 1.0.129
- Purpose: Office document automation
- Source: <https://github.com/iOfficeAI/OfficeCLI>
- License: Apache-2.0

The packaged executable is pinned by exact size and SHA-256. Version inspection must use
the inventory and build record, not execute the binary during packaging.

## Reasonix

- Version: 260710
- Source: <https://github.com/esengine/reasonix>
- License: MIT, included at `server/visionox-pkg/LICENSE`

## KaTeX

- Distribution: vendored Dashboard runtime
- Source: <https://github.com/KaTeX/KaTeX>
- License: MIT, included at `server/visionox-pkg/dashboard/vendor/katex/LICENSE`

## Bootstrap Skills

- Distribution: `bootstrap-skills/`
- Source: curated in this repository from project-authored and upstream skill packs; consult
  each `SKILL.md` frontmatter where source metadata is available
- License: mixed. Per-skill metadata governs each skill. The PDF skill has separate
  non-commercial terms at `bootstrap-skills/pdf/LICENSE.txt`; it must not be treated as MIT.

Package-level JavaScript dependency versions are locked by `server/visionox-pkg/package-lock.json`; their license files remain in the prepared runtime dependency tree.
