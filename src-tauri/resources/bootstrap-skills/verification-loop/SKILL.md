---
name: verification-loop
description: Verify changes with focused checks and report what was or was not tested.
description_zh: 用聚焦的检查验证修改，并说明已验证和未验证内容。
version: 1.0.0
license: MIT
metadata:
  builtin: true
  category: development
---

# Verification Loop

After making changes:

1. Run the most relevant small test, build, lint, or smoke check.
2. If a check fails, inspect the failure and fix the root cause when it is in scope.
3. If a check cannot be run, say why.
4. Summarize the exact verification performed.

Prefer targeted checks for narrow changes and broader checks for shared behavior, packaging, or user-facing workflows.
