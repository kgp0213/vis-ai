import { resolve, relative, isAbsolute } from "node:path";

// Returns true iff dirPath is workspaceDir itself or a descendant.
// Uses path.relative so Windows separator/case quirks are normalized by the OS.
// Shared between learn.mjs (production) and learn-sandbox.test.mjs (tests) to
// prevent drift.
export function isInsideWorkspace(dirPath, workspaceDir) {
  if (!workspaceDir) return false;
  const rel = relative(resolve(workspaceDir), resolve(dirPath));
  // rel === "" → same dir; rel.startsWith("..") → escapes workspace;
  // isAbsolute(rel) → cross-drive on Windows (e.g. D:\other vs C:\ws).
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
