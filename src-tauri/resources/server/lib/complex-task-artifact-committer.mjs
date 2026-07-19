import { createHash, randomUUID } from "node:crypto";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function modelFingerprint(task) {
  const values = Array.isArray(task?.contract?.pinned?.initialModelConfigFingerprints)
    ? task.contract.pinned.initialModelConfigFingerprints.map((item) => text(item)).filter(Boolean)
    : [];
  return values.join(",") || "host:assembler";
}

function fallbackKind(task, assembled) {
  const values = Object.values(task?.unitResults ?? {})
    .map((result) => text(result?.fallbackKind))
    .filter(Boolean);
  if (values.length > 0) return [...new Set(values)].join(",");
  if (assembled?.report?.fallbackCoverage?.length > 0) return "source";
  return "";
}

function conflictError(error) {
  const code = text(error?.code).toLowerCase();
  return Boolean(error?.requiresUserChoice)
    || ["document_output_conflict", "output_conflict", "output-path-conflict"].includes(code)
    || /output.*conflict|file.*appeared|path.*occupied/i.test(String(error?.message || error));
}

function userInputRequest(task, decision = {}, message = "输出路径需要用户确认") {
  const choices = Array.isArray(decision?.choices) ? clone(decision.choices) : [];
  return {
    kind: "user_input_request",
    requestId: `request:${randomUUID()}`,
    taskId: task.id,
    reason: text(decision?.id, "output-path-conflict"),
    question: text(decision?.question, message),
    choices,
    existingArtifactRefs: [],
    resumeToken: randomUUID(),
    expiresAt: null,
  };
}

function artifactId(task, role) {
  return `artifact:${text(task?.id, "task")}:${text(role, "final-result")}`;
}

/**
 * Commit an assembled generic task result without coupling the execution
 * kernel to a particular file format.  The caller supplies output reservation
 * and atomic-write callbacks so the same component can serve file, database,
 * or external-artifact adapters.
 */
export function createComplexTaskArtifactCommitter(options = {}) {
  const artifactStore = options.artifactStore;
  if (!artifactStore || typeof artifactStore.put !== "function") {
    throw new TypeError("complex task artifact committer requires an artifact store");
  }
  const reserveOutput = typeof options.reserveOutput === "function" ? options.reserveOutput : null;
  const writeOutput = typeof options.writeOutput === "function" ? options.writeOutput : null;
  const releaseOutput = typeof options.releaseOutput === "function" ? options.releaseOutput : null;

  async function commit({ task, assembled } = {}) {
    if (!task || typeof task !== "object" || !task.id) throw new TypeError("artifact commit requires a task");
    if (!assembled || typeof assembled !== "object") throw new TypeError("artifact commit requires an assembled result");
    if (assembled.ok !== true || assembled.report?.complete !== true) {
      return {
        ok: false,
        status: assembled.status || "partial",
        report: clone(assembled.report || { complete: false }),
        selectedArtifacts: clone(assembled.selectedArtifacts || []),
        content: assembled.content ?? "",
      };
    }

    const content = Buffer.isBuffer(assembled.content) || assembled.content instanceof Uint8Array
      ? Buffer.from(assembled.content)
      : Buffer.from(String(assembled.content ?? ""), "utf8");
    const requiredCoverage = Array.isArray(task.contract?.completion?.requiredCoverage)
      ? [...new Set(task.contract.completion.requiredCoverage.map((item) => text(item)).filter(Boolean))]
      : [];
    const requiredArtifacts = Array.isArray(task.contract?.completion?.requiredArtifacts)
      ? task.contract.completion.requiredArtifacts.map((item) => text(item)).filter(Boolean)
      : [];
    const role = requiredArtifacts[0] || "final-result";
    const manifestInput = {
      schemaVersion: 1,
      artifactId: artifactId(task, role),
      revision: positiveInteger(task?.metadata?.finalArtifactRevision, positiveInteger(task?.epoch, 1)),
      mediaType: text(task.contract?.output?.mediaType, "text/plain"),
      primaryCoverage: requiredCoverage,
      contextRefs: [],
      producer: {
        adapterVersion: text(task.contract?.pinned?.adapterVersion, "generic-v1"),
        skillHash: text(task.contract?.pinned?.skillHash, "sha256:unknown"),
        modelConfigFingerprint: modelFingerprint(task),
        toolSchemaVersion: text(task.contract?.pinned?.toolSchemaVersion, "1"),
        ...(fallbackKind(task, assembled) ? { fallbackKind: fallbackKind(task, assembled) } : {}),
      },
    };
    const stored = await artifactStore.put({ manifest: manifestInput, content });
    if (!stored?.manifest) throw new Error("final artifact store returned no manifest");
    const finalArtifact = { manifest: clone(stored.manifest), content: Buffer.from(content) };
    const requestedPath = text(task.contract?.output?.requestedPath);
    let reservation = null;
    let committed = false;
    try {
      if (requestedPath && reserveOutput) {
        reservation = await reserveOutput({ taskId: task.id, task: clone(task), requestedPath, content: Buffer.from(content), finalArtifact: clone(finalArtifact.manifest) });
        if (!reservation?.ok) {
          const request = userInputRequest(task, reservation?.decision, reservation?.error || "输出路径需要用户确认");
          request.existingArtifactRefs = [stored.manifest.artifactId];
          return {
            ok: false,
            waitingUser: true,
            status: "waiting_user",
            finalArtifact,
            artifactRefs: [stored.manifest.artifactId],
            userInputRequest: request,
            reason: reservation?.error || "output-path-conflict",
          };
        }
      }
      const outputPath = text(reservation?.outputPath, requestedPath);
      if (outputPath && writeOutput) {
        try {
          await writeOutput({ task: clone(task), outputPath, content: Buffer.from(content), finalArtifact: clone(finalArtifact.manifest), reservation: clone(reservation) });
        } catch (error) {
          if (!conflictError(error)) throw error;
          const request = userInputRequest(task, error?.decision, "输出路径在提交时发生冲突，请选择新的输出路径或确认覆盖。");
          request.existingArtifactRefs = [stored.manifest.artifactId];
          return {
            ok: false,
            waitingUser: true,
            status: "waiting_user",
            finalArtifact,
            artifactRefs: [stored.manifest.artifactId],
            outputPath: outputPath || null,
            userInputRequest: request,
            reason: error?.code || "output-conflict",
          };
        }
      }
      committed = true;
      return {
        ok: true,
        status: "committed",
        outputPath: outputPath || null,
        finalArtifact,
        artifactRefs: [stored.manifest.artifactId],
        report: clone(assembled.report),
        content: content.toString("utf8"),
      };
    } finally {
      if (reservation && releaseOutput) {
        await releaseOutput({ reservationId: reservation.reservationId, taskId: task.id, committed }).catch(() => {});
      }
    }
  }

  return { commit };
}
