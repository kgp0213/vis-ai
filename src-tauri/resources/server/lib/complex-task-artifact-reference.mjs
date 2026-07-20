const EXACT_ARTIFACT_REF_RE = /^(?<artifactId>[^@#]+)@r(?<revision>[1-9]\d*)#(?<sha256>[a-f0-9]{64})$/i;

export function parseArtifactReference(value) {
  const raw = String(value ?? "").trim();
  const match = EXACT_ARTIFACT_REF_RE.exec(raw);
  if (!match?.groups) return { raw, artifactId: raw, revision: null, sha256: null, exact: false };
  return {
    raw,
    artifactId: match.groups.artifactId,
    revision: Number(match.groups.revision),
    sha256: match.groups.sha256.toLowerCase(),
    exact: true,
  };
}

export function formatArtifactReference(manifest) {
  const artifactId = String(manifest?.artifactId ?? "").trim();
  const revision = Number(manifest?.revision);
  const sha256 = String(manifest?.sha256 ?? "").trim().toLowerCase();
  if (!artifactId || !Number.isSafeInteger(revision) || revision < 1 || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new TypeError("artifact manifest cannot form an exact reference");
  }
  return `${artifactId}@r${revision}#${sha256}`;
}
