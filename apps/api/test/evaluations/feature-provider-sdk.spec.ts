import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFeatureProvider } from "./feature-provider";
import { prepareFeaturePrompt } from "./feature-task";

import type { FeatureCatalogue } from "./feature-catalogue.types";

describe("installed AI SDK prompt compatibility with injected transport (no network)", () => {
  afterEach(() => {
    delete process.env.CORE_SDK_COMPAT_TEST_KEY;
  });

  it("accepts trusted composed system fragments and preserves user content through SDK validation", async () => {
    const catalogue = JSON.parse(
      readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8"),
    ) as FeatureCatalogue;
    const item = catalogue.features.find((feature) => feature.featureId === "mentor-teacher-chat")
      ?.items[0];
    if (!item) throw new Error("Missing real feature fixture");
    const { request } = prepareFeaturePrompt(item);
    process.env.CORE_SDK_COMPAT_TEST_KEY = "synthetic-key";
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const sentinel = new Error("Controlled SDK transport stopped before any network traffic");
    const fetch: typeof globalThis.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      throw sentinel;
    };
    const provider = createFeatureProvider(
      { model: "gpt-6-luna", apiKeyEnv: "CORE_SDK_COMPAT_TEST_KEY" },
      { fetch },
    );
    await expect(provider.model(request)).rejects.toThrow(sentinel.message);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe("/v1/responses");
    expect(calls[0].body.model).toBe("gpt-6-luna");
    const encodedInput = JSON.stringify(calls[0].body.input);
    for (const message of request.messages) {
      expect(encodedInput).toContain(JSON.stringify(message.content).slice(1, -1));
    }
    expect(calls[0].body.store).toBe(false);
  });
  it("sends the installed SDK native sentence array envelope to the provider", async () => {
    process.env.CORE_SDK_COMPAT_TEST_KEY = "synthetic-key";
    const { voiceDeliverySentenceSchema } = await import("src/ai/schemas/voice-delivery.schema");
    let captured: unknown;
    const provider = createFeatureProvider(
      { model: "gpt-6-luna", apiKeyEnv: "CORE_SDK_COMPAT_TEST_KEY" },
      {
        fetch: async (_url, init) => {
          captured = JSON.parse(String(init?.body));
          throw new Error("Controlled native array transport");
        },
      },
    );
    await expect(
      provider.model({
        kind: "prompt",
        messages: [{ role: "user", content: "Synthetic voice fixture" }],
        schema: voiceDeliverySentenceSchema,
        structuredOutputMode: "array",
      }),
    ).rejects.toThrow("Controlled native array transport");
    expect(captured).toEqual(
      expect.objectContaining({
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: "json_schema",
            schema: expect.objectContaining({
              properties: expect.objectContaining({
                elements: expect.objectContaining({
                  type: "array",
                  items: expect.objectContaining({ required: ["cue", "text"] }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });
});
