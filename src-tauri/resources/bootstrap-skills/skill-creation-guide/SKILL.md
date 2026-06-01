---
name: skill-creation-guide
description: Offline guide for creating, packaging, installing, and repairing Visionox skills.
description_zh: Visionox Skill 创建、打包、安装和故障修复的离线指南。
version: 1.0.0
license: MIT
metadata:
  builtin: true
  category: system
---

# Skill Creation Guide

Use this skill when the user needs to create, import, package, diagnose, or repair Visionox skills.

## Emergency Recovery

Visionox keeps global skills in:

```text
~/.visionox/skills/<skill-name>/
```

Every skill directory must contain a root `SKILL.md` with YAML frontmatter:

```yaml
---
name: my-skill
description: One-line description that helps the model choose this skill.
version: 1.0.0
---
```

If skill installation is broken, use the Skills panel repair action first. It restores Visionox bootstrap skills without deleting user-created skills.

Manual fallback:

1. Create `~/.visionox/skills/<skill-name>/`.
2. Add `SKILL.md` at the root.
3. Put scripts in `scripts/`, references in `references/`, and templates in `templates/`.
4. Start a new conversation so the skill index is rebuilt.

## Naming

Use lowercase English letters, numbers, and hyphens only:

```text
my-skill-name
```

Avoid spaces, Chinese characters, and uppercase letters in skill names and script filenames.

## Installation Choices

- `source_dir`: best for full skill folders during development.
- `.skill` or `.zip`: best for sharing across machines.
- `body`: only for a single `SKILL.md` without helper files.

When a skill includes `scripts/`, `references/`, `templates/`, `README.md`, or metadata files, prefer `source_dir` or `.skill`.

## Quality Checklist

- `SKILL.md` has valid frontmatter and a precise description.
- The skill states what it supports and what it does not support.
- Scripts show usage when called without required arguments.
- Scripts return non-zero exit codes on failure.
- Dependencies and setup commands are documented in `README.md`.
- A simple sample input or smoke test is included when practical.
