(function attachVisionoxOverviewAlertPolicy(root) {
  function positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function evaluate(state = {}) {
    const alerts = [];
    if (state.modelVerificationDirty) alerts.push({ kind: "model_retest", tone: "warn" });
    if (state.modelDrift) alerts.push({ kind: "model_drift", tone: "warn" });

    const pendingEdits = positiveNumber(state.pendingEdits);
    if (pendingEdits !== null) alerts.push({ kind: "pending_edits", tone: "warn", count: pendingEdits });

    const corruptBackups = positiveNumber(state.corruptBackups);
    if (corruptBackups !== null) alerts.push({ kind: "corrupt_backups", tone: "warn", count: corruptBackups });

    const storageIssues = positiveNumber(state.storageIssues);
    if (storageIssues !== null) alerts.push({ kind: "storage_issues", tone: "err", count: storageIssues });

    if (state.retrievalMode === "auto" && state.semanticAvailable === false) {
      alerts.push({ kind: "missing_index", tone: "warn" });
    }

    const budgetPct = Number(state.budgetPct);
    if (state.budgetKind !== "off" && Number.isFinite(budgetPct) && budgetPct >= 80) {
      alerts.push({ kind: "budget", tone: budgetPct >= 100 ? "err" : "warn", pct: budgetPct });
    }
    return alerts;
  }

  root.VisionoxOverviewAlertPolicy = Object.freeze({ evaluate });
})(globalThis);
