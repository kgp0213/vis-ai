import { parseArtifactReference } from "./complex-task-artifact-reference.mjs";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function uniqueStrings(value) {
  return Array.isArray(value) ? [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))] : [];
}

function artifactKey(artifact) {
  return `${artifact.manifest.artifactId}@${artifact.manifest.revision}`;
}

function defaultCandidate(candidates) {
  return [...candidates].sort((left, right) => Number(right.manifest.revision) - Number(left.manifest.revision)
    || String(left.manifest.artifactId).localeCompare(String(right.manifest.artifactId)))[0];
}

function selectedCandidate(choice, candidates) {
  if (!choice) return null;
  const id = typeof choice === "string" ? choice : choice?.manifest?.artifactId ?? choice?.artifactId;
  const revision = typeof choice === "object" ? choice?.manifest?.revision ?? choice?.revision : undefined;
  return candidates.find((candidate) => candidate.manifest.artifactId === id
    && (revision === undefined || Number(candidate.manifest.revision) === Number(revision))) ?? null;
}

function invalidEntry(code, fields = {}) {
  return { code, ...clone(fields) };
}

function producerMismatch(task, manifest) {
  const pinned = task?.contract?.pinned;
  if (!pinned || typeof pinned !== "object") return [];
  const producer = manifest?.producer ?? {};
  const fields = ["adapterVersion", "skillHash", "toolSchemaVersion"]
    .filter((field) => String(pinned[field] ?? "") && String(producer[field] ?? "") !== String(pinned[field]));
  const allowedModels = new Set([
    ...(Array.isArray(pinned.initialModelConfigFingerprints) ? pinned.initialModelConfigFingerprints : []),
    task?.metadata?.currentModelConfigFingerprint,
    ...(Array.isArray(task?.metadata?.modelConfigFingerprints) ? task.metadata.modelConfigFingerprints : []),
  ].map((value) => String(value ?? "").trim()).filter(Boolean));
  const model = String(producer.modelConfigFingerprint ?? "").trim();
  if (allowedModels.size > 0 && !allowedModels.has(model) && !model.startsWith("host:")) fields.push("modelConfigFingerprint");
  return fields;
}

export async function assembleComplexTask({ task, artifactStore, adapter = {} } = {}) {
  if (!task || typeof task !== "object") throw new TypeError("assembleComplexTask requires a task snapshot");
  if (!artifactStore || typeof artifactStore.read !== "function") throw new TypeError("assembleComplexTask requires an artifact store");

  const rawRequired = task.contract?.completion?.requiredCoverage;
  const required = uniqueStrings(rawRequired);
  if (!Array.isArray(rawRequired) || rawRequired.length === 0 || required.length !== rawRequired.length) {
    return {
      ok: false,
      status: "partial",
      content: "",
      selectedArtifacts: [],
      report: {
        complete: false,
        required,
        covered: [],
        missing: required,
        conflicts: [],
        invalid: [invalidEntry("invalid-contract", { field: "completion.requiredCoverage" })],
        selectedByCoverage: {},
        contextOnlyArtifacts: [],
      },
    };
  }
  const unitPlans = Array.isArray(task.unitPlans) ? task.unitPlans : [];
  const plansById = new Map(unitPlans.map((plan) => [String(plan.unitId), plan]));
  const unitResults = Array.isArray(task.unitResults) ? task.unitResults : Object.values(task.unitResults ?? {});
  const invalid = [];
  const candidatesByCoverage = new Map(required.map((coverage) => [coverage, []]));
  const loaded = new Map();
  const contextOnlyArtifacts = new Set();

  for (const unitResult of unitResults) {
    const unitId = String(unitResult?.unitId ?? "");
    const plan = plansById.get(unitId);
    if (!plan) {
      invalid.push(invalidEntry("unknown-unit", { unitId }));
      continue;
    }
    const authorized = new Set(uniqueStrings(plan.primaryCoverage));
    for (const ref of uniqueStrings(unitResult?.artifactRefs)) {
      const reference = parseArtifactReference(ref);
      let artifact;
      try {
        artifact = await artifactStore.read(ref);
      } catch (error) {
        const code = error?.code === "ARTIFACT_HASH_MISMATCH" ? "hash-mismatch"
          : ["ARTIFACT_REFERENCE_HASH_MISMATCH", "ARTIFACT_REFERENCE_MISMATCH"].includes(error?.code) ? "artifact-pin-mismatch"
          : error?.code === "ARTIFACT_NOT_FOUND" ? "artifact-missing"
            : "artifact-invalid";
        invalid.push(invalidEntry(code, { artifactId: reference.artifactId, artifactRef: ref, unitId, message: String(error?.message || error) }));
        continue;
      }
      const key = artifactKey(artifact);
      if (loaded.has(key)) artifact = loaded.get(key);
      else loaded.set(key, artifact);
      const owner = artifact.manifest.owner;
      if (owner) {
        if (owner.taskId !== task.id) invalid.push(invalidEntry("foreign-task-artifact", { artifactId: reference.artifactId, unitId, ownerTaskId: owner.taskId }));
        if (owner.kind !== "unit" || owner.unitId !== unitId) invalid.push(invalidEntry("foreign-unit-artifact", { artifactId: reference.artifactId, unitId, ownerUnitId: owner.unitId ?? null }));
      } else if (task?.contract?.pinned) invalid.push(invalidEntry("artifact-owner-missing", { artifactId: reference.artifactId, unitId }));
      if (task?.contract?.pinned && !reference.exact) invalid.push(invalidEntry("artifact-reference-unpinned", { artifactId: reference.artifactId, unitId }));
      const mismatchedProducerFields = producerMismatch(task, artifact.manifest);
      if (mismatchedProducerFields.length) invalid.push(invalidEntry("producer-mismatch", { artifactId: reference.artifactId, unitId, fields: mismatchedProducerFields }));
      if ((owner && (owner.taskId !== task.id || owner.kind !== "unit" || owner.unitId !== unitId)) || mismatchedProducerFields.length > 0) continue;
      const primary = Array.isArray(artifact.manifest.primaryCoverage) ? artifact.manifest.primaryCoverage.map(String) : [];
      if (new Set(primary).size !== primary.length) {
        invalid.push(invalidEntry("duplicate-primary-coverage", { artifactId: ref, unitId }));
        continue;
      }
      const unauthorized = primary.filter((coverage) => !authorized.has(coverage));
      if (unauthorized.length) {
        invalid.push(invalidEntry("unauthorized-primary-coverage", { artifactId: ref, unitId, coverage: unauthorized }));
        continue;
      }
      const contextRefs = Array.isArray(artifact.manifest.contextRefs) ? artifact.manifest.contextRefs : [];
      if (contextRefs.some((context) => !context || context.role !== "context-only")) {
        invalid.push(invalidEntry("invalid-context-reference", { artifactId: ref, unitId }));
        continue;
      }
      const candidate = { ...artifact, unitId, unitPlan: plan, unitResult };
      if (primary.length === 0 && contextRefs.length > 0) contextOnlyArtifacts.add(artifact.manifest.artifactId);
      for (const coverage of primary) {
        if (candidatesByCoverage.has(coverage)) candidatesByCoverage.get(coverage).push(candidate);
      }
    }
  }

  const provisional = new Map();
  const missing = [];
  for (const coverage of required) {
    const candidates = candidatesByCoverage.get(coverage) ?? [];
    if (candidates.length === 0) {
      missing.push(coverage);
      continue;
    }
    let chosen;
    if (typeof adapter.selectPrimaryCandidate === "function") {
      let choice;
      try {
        choice = await adapter.selectPrimaryCandidate({ coverage, candidates, task, unitPlan: candidates[0]?.unitPlan });
      } catch (error) {
        invalid.push(invalidEntry("selector-error", { coverage, message: String(error?.message || error) }));
        continue;
      }
      chosen = selectedCandidate(choice, candidates);
      if (!chosen) {
        invalid.push(invalidEntry("selector-invalid", { coverage }));
        continue;
      }
    } else chosen = defaultCandidate(candidates);
    provisional.set(coverage, chosen);
  }

  const selectedSet = new Map();
  for (const candidate of provisional.values()) selectedSet.set(artifactKey(candidate), candidate);
  const selectedByCoverage = {};
  const conflicts = [];
  for (const coverage of required) {
    const covering = [...selectedSet.values()].filter((candidate) => candidate.manifest.primaryCoverage.includes(coverage));
    if (covering.length === 0) {
      if (!missing.includes(coverage)) missing.push(coverage);
      continue;
    }
    if (covering.length > 1) {
      conflicts.push(coverage);
      continue;
    }
    selectedByCoverage[coverage] = covering[0].manifest.artifactId;
  }

  const coverageIndex = new Map(required.map((coverage, index) => [coverage, index]));
  const selectedArtifacts = [...selectedSet.values()].filter((candidate) => candidate.manifest.primaryCoverage.some((coverage) => selectedByCoverage[coverage] === candidate.manifest.artifactId))
    .sort((left, right) => Math.min(...left.manifest.primaryCoverage.map((coverage) => coverageIndex.get(coverage) ?? Number.MAX_SAFE_INTEGER))
      - Math.min(...right.manifest.primaryCoverage.map((coverage) => coverageIndex.get(coverage) ?? Number.MAX_SAFE_INTEGER))
      || String(left.manifest.artifactId).localeCompare(String(right.manifest.artifactId)));

  const covered = required.filter((coverage) => selectedByCoverage[coverage] && !conflicts.includes(coverage));
  const report = {
    complete: missing.length === 0 && conflicts.length === 0 && invalid.length === 0 && covered.length === required.length,
    required,
    covered,
    missing: [...new Set(missing)],
    conflicts: [...new Set(conflicts)],
    invalid,
    selectedByCoverage,
    contextOnlyArtifacts: [...contextOnlyArtifacts].sort(),
  };

  let content = "";
  try {
    if (typeof adapter.assemble === "function") {
      const assembled = await adapter.assemble({ task, selectedArtifacts, report: clone(report) });
      if (assembled === undefined || assembled === null) throw new Error("Adapter returned no assembled output");
      content = Buffer.isBuffer(assembled) || assembled instanceof Uint8Array ? Buffer.from(assembled).toString("utf8") : String(assembled);
    } else {
      content = selectedArtifacts.map((artifact) => artifact.content.toString("utf8")).join("\n\n");
    }
  } catch (error) {
    report.invalid.push(invalidEntry("assembly-error", { message: String(error?.message || error) }));
    report.complete = false;
  }

  return {
    ok: report.complete,
    status: report.complete ? "complete" : "partial",
    content,
    selectedArtifacts,
    report,
  };
}
