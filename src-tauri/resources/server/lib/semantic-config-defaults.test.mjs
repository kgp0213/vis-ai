import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SEMANTIC_EMBEDDING_MODEL,
  DEFAULT_SEMANTIC_EMBEDDING_URL,
  applySemanticEmbeddingDefaults,
} from "./semantic-config-defaults.mjs";

describe("semantic embedding installation defaults", () => {
  test("seeds a new installation without persisting an example API key", () => {
    const config = {};

    const result = applySemanticEmbeddingDefaults(config);

    assert.equal(result.changed, true);
    assert.equal(config.semantic.provider, "openai-compat");
    assert.equal(config.semantic.openaiCompat.baseUrl, "http://10.71.4.202:10307/v1/embeddings");
    assert.equal(config.semantic.openaiCompat.model, "Qwen3-Embedding");
    assert.equal(config.semantic.openaiCompat.apiKey, "");
    assert.equal(DEFAULT_SEMANTIC_EMBEDDING_URL, config.semantic.openaiCompat.baseUrl);
    assert.equal(DEFAULT_SEMANTIC_EMBEDDING_MODEL, config.semantic.openaiCompat.model);
  });

  test("fills blank URL and model fields while preserving a user API key", () => {
    const config = {
      semantic: {
        provider: "openai-compat",
        openaiCompat: { baseUrl: " ", apiKey: "user-secret", model: "" },
      },
    };

    applySemanticEmbeddingDefaults(config);

    assert.equal(config.semantic.openaiCompat.baseUrl, DEFAULT_SEMANTIC_EMBEDDING_URL);
    assert.equal(config.semantic.openaiCompat.model, DEFAULT_SEMANTIC_EMBEDDING_MODEL);
    assert.equal(config.semantic.openaiCompat.apiKey, "user-secret");
  });

  test("does not overwrite a complete custom embedding configuration", () => {
    const config = {
      semantic: {
        provider: "openai-compat",
        openaiCompat: {
          baseUrl: "https://embedding.example/v1/embeddings",
          apiKey: "custom-key",
          model: "custom-embedding-model",
          extraBody: { dimensions: 1024 },
        },
        ollama: { baseUrl: "http://127.0.0.1:11434", model: "nomic-embed-text" },
      },
    };

    const result = applySemanticEmbeddingDefaults(config);

    assert.equal(result.changed, false);
    assert.equal(config.semantic.openaiCompat.baseUrl, "https://embedding.example/v1/embeddings");
    assert.equal(config.semantic.openaiCompat.apiKey, "custom-key");
    assert.equal(config.semantic.openaiCompat.model, "custom-embedding-model");
    assert.deepEqual(config.semantic.openaiCompat.extraBody, { dimensions: 1024 });
  });
});
