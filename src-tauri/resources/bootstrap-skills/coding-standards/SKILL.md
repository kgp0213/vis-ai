---
name: coding-standards
description: Apply conservative coding standards that match the existing project.
description_zh: 遵循项目现有风格和保守工程规范进行代码修改。
version: 1.0.0
license: MIT
metadata:
  builtin: true
  category: development
---

# Coding Standards

Use the project's existing patterns first. Keep edits scoped to the user request, avoid unrelated refactors, and preserve user changes in a dirty worktree.

Prefer structured APIs over ad hoc string manipulation when the codebase or runtime provides them. Add comments only where they clarify non-obvious logic.

Before finishing code changes, run the narrowest useful verification available in the repository.
