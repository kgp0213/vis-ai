import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  isKnowledgeResponseCurrent,
  knowledgeDocumentStatusKey,
} from "../visionox-pkg/dashboard/src/lib/knowledge-documents-coordination.ts";

describe("knowledge document dashboard coordination", () => {
  test("accepts only the latest response in the same workspace scope", () => {
    const base = {
      requestId: "request-2",
      latestRequestId: "request-2",
      requestWorkspaceFingerprint: "workspace-a",
      currentWorkspaceFingerprint: "workspace-a",
      responseWorkspaceFingerprint: "workspace-a",
    };
    assert.equal(isKnowledgeResponseCurrent(base), true);
    assert.equal(isKnowledgeResponseCurrent({ ...base, latestRequestId: "request-3" }), false);
    assert.equal(isKnowledgeResponseCurrent({ ...base, currentWorkspaceFingerprint: "workspace-b" }), false);
    assert.equal(isKnowledgeResponseCurrent({ ...base, responseWorkspaceFingerprint: "workspace-b" }), false);
  });

  test("allows the latest initial list response to establish a workspace scope", () => {
    assert.equal(isKnowledgeResponseCurrent({
      requestId: "request-1",
      latestRequestId: "request-1",
      requestWorkspaceFingerprint: null,
      currentWorkspaceFingerprint: null,
      responseWorkspaceFingerprint: "workspace-a",
    }), true);
  });

  test("maps every catalog status to a stable translation key", () => {
    assert.equal(knowledgeDocumentStatusKey("indexed"), "knowledgeDocsStatusIndexed");
    assert.equal(knowledgeDocumentStatusKey("indexing"), "knowledgeDocsStatusIndexing");
    assert.equal(knowledgeDocumentStatusKey("failed"), "knowledgeDocsStatusFailed");
    assert.equal(knowledgeDocumentStatusKey("deleted_pending_index"), "knowledgeDocsStatusDeleted");
    assert.equal(knowledgeDocumentStatusKey("unexpected"), "knowledgeDocsStatusPending");
  });
});
