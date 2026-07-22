// Compatibility re-export for persisted complex-task records. Active runtime
// code imports the neutral module directly so artifact projections do not
// depend on a retired task execution namespace.
export { formatArtifactReference, parseArtifactReference } from "../../src-tauri/resources/server/lib/artifact-reference.mjs";
