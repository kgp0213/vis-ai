const LEGACY_BOOTSTRAP_DIRECTORY_HASHES = new Map([
  ["pdf", new Set([
    // Bundled PDF Skill distributed before builtin ownership markers were introduced.
    "d587374b670b85430785212e4fa19304949ce510e253208d0014763d2fb3e681",
  ])],
]);

export function isKnownLegacyBootstrapSkill(name, directoryHash) {
  const hashes = LEGACY_BOOTSTRAP_DIRECTORY_HASHES.get(String(name ?? ""));
  return Boolean(hashes?.has(String(directoryHash ?? "").toLowerCase()));
}
