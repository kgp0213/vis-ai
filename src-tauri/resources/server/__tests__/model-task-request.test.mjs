import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  requestModelJson,
  requestModelText,
  assertUsableModelResponse,
  assertModelProbeMarker,
} from "../lib/model-task-request.mjs";

function fakeClient(response) {
  const calls = [];
  return {
    calls,
    async chat(options) {
      calls.push(options);
      return typeof response === "function" ? response(options) : response;
    },
  };
}

const baseMessages = [
  { role: "system", content: "Return JSON." },
  { role: "user", content: "Do the task." },
];

describe("model task request policy", () => {
  test("launcher and /learn wire task-specific request purposes", () => {
    const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
    const learn = readFileSync(new URL("../learn.mjs", import.meta.url), "utf8");
    assert.match(launcher, /requestPurpose: "summary"/);
    assert.match(launcher, /requestPurpose: "report"/);
    assert.match(launcher, /requestPurpose: "knowledge"/);
    assert.match(launcher, /requestPurpose: "sessionReview"/);
    assert.match(launcher, /VISIONOX_PROBE_OK_7F3A/);
    assert.match(learn, /requestPurpose: "learn"/);
    assert.match(launcher, /capabilities: resolveProviderModelCapabilities\(getActiveProvider\(config\), modelConfig\.model\)/);
  });

  test("only asks for structured output when the model declares support", async () => {
    const unsupported = fakeClient({ content: '{"ok":true}', finishReason: "stop" });
    await requestModelJson({
      client: unsupported,
      model: "text-only",
      capabilities: { structuredOutput: false, maxOutputTokens: 4096 },
      messages: baseMessages,
      maxTokens: 2048,
      label: "test",
    });
    assert.equal(unsupported.calls[0].responseFormat, undefined);

    const supported = fakeClient({ content: '{"ok":true}', finishReason: "stop" });
    await requestModelJson({
      client: supported,
      model: "json-model",
      capabilities: { structuredOutput: true, maxOutputTokens: 4096 },
      messages: baseMessages,
      maxTokens: 2048,
      label: "test",
    });
    assert.deepEqual(supported.calls[0].responseFormat, { type: "json_object" });

    const arrayShape = fakeClient({ content: "[]", finishReason: "stop" });
    await requestModelJson({
      client: arrayShape,
      model: "json-model",
      capabilities: { structuredOutput: true, maxOutputTokens: 4096 },
      messages: baseMessages,
      maxTokens: 2048,
      preferStructuredOutput: false,
      label: "array task",
    });
    assert.equal(arrayShape.calls[0].responseFormat, undefined);
  });

  test("falls back without response_format when a declared capability is rejected", async () => {
    let attempts = 0;
    const client = fakeClient((options) => {
      attempts++;
      if (options.responseFormat) throw new Error("response_format json_object is unsupported");
      return { content: '{"ok":true}', finishReason: "stop" };
    });

    const result = await requestModelJson({
      client,
      model: "misdeclared-json-model",
      capabilities: { structuredOutput: true, maxOutputTokens: 4096 },
      messages: baseMessages,
      maxTokens: 2048,
      label: "fallback task",
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(attempts, 2);
    assert.deepEqual(client.calls[0].responseFormat, { type: "json_object" });
    assert.equal(client.calls[1].responseFormat, undefined);
  });

  test("rejects JSON and text responses that ended at length or content-filter", async () => {
    for (const finishReason of ["length", "content_filter"]) {
      const jsonClient = fakeClient({ content: '{"ok":true}', finishReason });
      await assert.rejects(
        requestModelJson({
          client: jsonClient,
          model: "model",
          capabilities: { structuredOutput: false, maxOutputTokens: 4096 },
          messages: baseMessages,
          maxTokens: 2048,
          label: "json task",
        }),
        new RegExp(finishReason),
      );

      const textClient = fakeClient({ content: "partial", finishReason });
      await assert.rejects(
        requestModelText({
          client: textClient,
          model: "model",
          capabilities: { maxOutputTokens: 4096 },
          messages: baseMessages,
          maxTokens: 2048,
          label: "text task",
        }),
        new RegExp(finishReason),
      );
    }

    const rawOnly = fakeClient({
      content: '{"ok":true}',
      raw: { choices: [{ finish_reason: "length" }] },
    });
    await assert.rejects(
      requestModelJson({
        client: rawOnly,
        model: "model",
        capabilities: { structuredOutput: false, maxOutputTokens: 4096 },
        messages: baseMessages,
        maxTokens: 2048,
        label: "raw finish reason task",
      }),
      /length/,
    );
  });

  test("clamps explicit maxTokens to the declared model output capacity", async () => {
    const client = fakeClient({ content: '{"ok":true}', finishReason: "stop" });
    await requestModelJson({
      client,
      model: "small-output-model",
      capabilities: { structuredOutput: false, maxOutputTokens: 1024 },
      messages: baseMessages,
      maxTokens: 8192,
      label: "test",
    });
    assert.equal(client.calls[0].maxTokens, 1024);
  });

  test("passes every task purpose through to the provider request", async () => {
    const purposes = ["summary", "report", "knowledge", "sessionReview", "learn"];
    for (const requestPurpose of purposes) {
      const client = fakeClient({ content: '{"ok":true}', finishReason: "stop" });
      await requestModelJson({
        client,
        model: "model",
        capabilities: { structuredOutput: false, maxOutputTokens: 4096 },
        messages: baseMessages,
        maxTokens: 2048,
        requestPurpose,
        label: `${requestPurpose} task`,
      });
      assert.equal(client.calls[0].requestPurpose, requestPurpose);
    }
  });

  test("rejects an empty text response instead of treating it as a successful artifact", async () => {
    const client = fakeClient({ content: "", finishReason: "stop" });
    await assert.rejects(
      requestModelText({
        client,
        model: "model",
        capabilities: { maxOutputTokens: 4096 },
        messages: baseMessages,
        maxTokens: 2048,
        requestPurpose: "report",
        label: "report",
      }),
      /empty response/i,
    );
  });

  test("probe responses require non-empty content and the expected marker", () => {
    assert.equal(assertUsableModelResponse({ content: "VISIONOX_PROBE_OK_7F3A", finishReason: "stop" }, { label: "probe" }), "VISIONOX_PROBE_OK_7F3A");
    assert.throws(() => assertUsableModelResponse({ content: "", finishReason: "stop" }, { label: "probe" }), /empty response/);
    assert.throws(() => assertUsableModelResponse({ content: "partial", finishReason: "length" }, { label: "probe" }), /length/);
    assert.equal(assertModelProbeMarker({ content: '"VISIONOX_PROBE_OK_7F3A"', finishReason: "stop" }, "VISIONOX_PROBE_OK_7F3A"), "VISIONOX_PROBE_OK_7F3A");
    assert.throws(() => assertModelProbeMarker({ content: "The marker is VISIONOX_PROBE_OK_7F3A", finishReason: "stop" }, "VISIONOX_PROBE_OK_7F3A"), /did not exactly echo/);
  });
});
