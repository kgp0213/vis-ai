import { assertVersionedJsonWritable, readVersionedJsonFile, writeVersionedJsonFile } from "./versioned-json-file.mjs";

const OPTIONS = { version: 1, allowUnversioned: true };

export function createActiveSessionMetaStore({ path, onIssue = () => {} }) {
  if (!path) throw new TypeError("active session metadata path is required");

  function read() {
    const stored = readVersionedJsonFile(path, OPTIONS);
    onIssue(stored.error);
    return stored;
  }

  function update(buildValue) {
    if (typeof buildValue !== "function") throw new TypeError("active session metadata update requires a builder");
    try {
      const stored = assertVersionedJsonWritable(path, OPTIONS);
      const next = buildValue(stored.value ?? {});
      const written = writeVersionedJsonFile(path, next, OPTIONS);
      onIssue(null);
      return written;
    } catch (error) {
      onIssue(error.message);
      throw error;
    }
  }

  return { read, update };
}
