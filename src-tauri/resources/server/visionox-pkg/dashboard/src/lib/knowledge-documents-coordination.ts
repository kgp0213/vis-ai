export interface KnowledgeResponseScope {
  requestId: string;
  latestRequestId: string;
  requestWorkspaceFingerprint: string | null;
  currentWorkspaceFingerprint: string | null;
  responseWorkspaceFingerprint: string | null;
}

export function isKnowledgeResponseCurrent(scope: KnowledgeResponseScope): boolean {
  if (!scope.requestId || scope.requestId !== scope.latestRequestId) return false;
  if (!scope.requestWorkspaceFingerprint) return Boolean(scope.responseWorkspaceFingerprint);
  return scope.currentWorkspaceFingerprint === scope.requestWorkspaceFingerprint
    && scope.responseWorkspaceFingerprint === scope.requestWorkspaceFingerprint;
}

export function knowledgeDocumentStatusKey(status: string): string {
  switch (status) {
    case "indexed": return "knowledgeDocsStatusIndexed";
    case "indexing": return "knowledgeDocsStatusIndexing";
    case "failed": return "knowledgeDocsStatusFailed";
    case "deleted_pending_index": return "knowledgeDocsStatusDeleted";
    case "ready":
    case "stale":
    default:
      return "knowledgeDocsStatusPending";
  }
}
