export const DEFAULT_SEMANTIC_EMBEDDING_URL = "http://10.71.4.202:10307/v1/embeddings";
export const DEFAULT_SEMANTIC_EMBEDDING_MODEL = "Qwen3-Embedding";

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function applySemanticEmbeddingDefaults(config) {
  let changed = false;
  let semantic = objectOrNull(config.semantic);
  if (!semantic) {
    semantic = {};
    config.semantic = semantic;
    changed = true;
  }

  if (typeof semantic.provider !== "string" || !semantic.provider.trim()) {
    semantic.provider = "openai-compat";
    changed = true;
  }

  let openaiCompat = objectOrNull(semantic.openaiCompat);
  if (!openaiCompat) {
    openaiCompat = {};
    semantic.openaiCompat = openaiCompat;
    changed = true;
  }
  if (typeof openaiCompat.baseUrl !== "string" || !openaiCompat.baseUrl.trim()) {
    openaiCompat.baseUrl = DEFAULT_SEMANTIC_EMBEDDING_URL;
    changed = true;
  }
  if (typeof openaiCompat.apiKey !== "string") {
    openaiCompat.apiKey = "";
    changed = true;
  }
  if (typeof openaiCompat.model !== "string" || !openaiCompat.model.trim()) {
    openaiCompat.model = DEFAULT_SEMANTIC_EMBEDDING_MODEL;
    changed = true;
  }
  if (!objectOrNull(openaiCompat.extraBody)) {
    openaiCompat.extraBody = {};
    changed = true;
  }

  let ollama = objectOrNull(semantic.ollama);
  if (!ollama) {
    ollama = {};
    semantic.ollama = ollama;
    changed = true;
  }
  if (typeof ollama.baseUrl !== "string") {
    ollama.baseUrl = "";
    changed = true;
  }
  if (typeof ollama.model !== "string") {
    ollama.model = "";
    changed = true;
  }

  return { changed, semantic };
}
