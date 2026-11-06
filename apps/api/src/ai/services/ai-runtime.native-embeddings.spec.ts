import { once } from "node:events";
import { createServer } from "node:http";

import { AiCapability } from "@mentingo/luma-sdk";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { EnvService } from "src/env/services/env.service";

/** Exercise the installed SDK's actual native transport, not a mocked SDK method. */
describe("AiRuntimeService native SDK embeddings contract", () => {
  let server: Server;
  const originalBaseUrl = process.env.LUMA_BASE_URL;
  const requests: {
    path: string | undefined;
    key: string | string[] | undefined;
    body: unknown;
  }[] = [];

  beforeEach(async () => {
    requests.length = 0;
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests.push({ path: request.url, key: request.headers["x-api-key"], body });
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ embeddings: [Array(1536).fill(0.25)], model: "local-reader" }));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    process.env.LUMA_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (originalBaseUrl === undefined) delete process.env.LUMA_BASE_URL;
    else process.env.LUMA_BASE_URL = originalBaseUrl;
    jest.restoreAllMocks();
  });

  it("preserves the native path, API key, raw text, requested size and resolved model", async () => {
    const service = new AiRuntimeService({
      getEnv: jest.fn().mockResolvedValue({ value: "synthetic-luma-key" }),
    } as unknown as EnvService);
    jest.spyOn(service, "resolveSource").mockResolvedValue(AI_RUNTIME_SOURCES.LUMA);
    const coreProvider = jest
      .spyOn(service, "getAISdkOpenAI")
      .mockRejectedValue(new Error("Core fallback must not execute in the native transport test"));

    await expect(
      service.createSemanticSearchEmbeddings({
        values: ["Zażółć — source text must retain its own tokenizer vocabulary."],
        dimensions: 1536,
        coreModel: "text-embedding-3-small",
        timeoutMs: 3000,
      }),
    ).resolves.toEqual({ embeddings: [Array(1536).fill(0.25)], model: "local-reader" });

    expect(service.resolveSource).toHaveBeenCalledWith(AiCapability.AiMentorRagEmbeddings);
    expect(requests).toEqual([
      {
        path: "/api/public/v1/ai/embeddings",
        key: "synthetic-luma-key",
        body: {
          texts: ["Zażółć — source text must retain its own tokenizer vocabulary."],
          dimensions: 1536,
        },
      },
    ]);
    expect(coreProvider).not.toHaveBeenCalled();
  });
});
