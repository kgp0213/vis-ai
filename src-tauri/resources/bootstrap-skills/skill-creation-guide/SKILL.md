---
name: skill-creation-guide
description: Create, package, install, update, diagnose, or repair Visionox Skills. Use this whenever the user asks to install or import a local .skill/.zip archive or Skill directory.
license: MIT
metadata:
  builtin: true
  category: system
---

# Visionox Skill Workflow

Use the host `install_skill` tool for installation. Do not install a Skill with generic filesystem or shell copy commands.

## Install an existing Skill

Follow this decision order exactly:

1. If the user supplied a `.skill` or `.zip` file, call `install_skill` with `name` and the exact archive path in `source`.
2. If the user supplied only one complete `SKILL.md`, call `install_skill` with `name` and `body`.
3. Use `source_dir` only when the user explicitly supplied a directory and no archive was supplied.

For an archive installation:

- Do not search for or prefer a same-named directory beside the archive.
- Do not extract the archive manually before calling `install_skill`.
- Do not use `Copy-Item -Recurse`, `cp`, `robocopy`, `xcopy`, a custom script, or another recursive-copy mechanism.
- Do not execute scripts from the Skill or download dependencies during installation.
- Claim success only when the tool returns `installed: true`. Report the returned error otherwise.

After successful installation, tell the user to start a new conversation or use `/new` before invoking the Skill.

## Create or update a Skill

Use lowercase letters, numbers, and hyphens for the directory and frontmatter name. Keep the Skill focused and place only reusable resources beside `SKILL.md`:

```text
skill-name/
|- SKILL.md
|- scripts/       # deterministic helpers, when needed
|- references/    # detailed material loaded on demand
`- assets/        # templates or output resources, when needed
```

Write a precise `description` that states both the capability and the requests that should trigger it. Keep the body procedural and concise. Do not add auxiliary documentation that the Skill does not need.

Before packaging:

- Validate the `SKILL.md` frontmatter and name.
- Run a representative smoke test for every bundled script.
- Make scripts display usage for missing arguments and return non-zero on failure.
- Keep API keys, tokens, user identities, and machine-specific paths out of the package.
- Put `SKILL.md` at the archive root or inside one top-level Skill directory.

## Repair

Use the Skills panel repair action for missing bootstrap Skills. It restores managed Skills without deleting user-created Skills. Do not work around a failed installation by manually copying files into `~/.visionox/skills`.
