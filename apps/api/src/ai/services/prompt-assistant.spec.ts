import { LangfuseClient } from "@langfuse/client";
import { promptTemplates } from "@repo/prompts";

import { PromptService } from "./prompt.service";

import type { AiRepository } from "src/ai/repositories/ai.repository";
import type { MessageService } from "src/ai/services/message.service";
import type { RagService } from "src/ai/services/rag.service";
import type { TokenService } from "src/ai/services/token.service";
import type { EnvService } from "src/env/services/env.service";

describe("Assistant managed prompts", () => {
  const vars = {
    interfaceLanguage: "pl",
    moduleCapabilities: JSON.stringify({ articles: { enabled: false, canRead: false } }),
  };
  const template = promptTemplates.coreAssistantPrompt.template;

  function fixture(managed = true) {
    const service = new PromptService(
      {} as AiRepository,
      {} as MessageService,
      {} as TokenService,
      {} as RagService,
      {} as EnvService,
    );
    service.onModuleInit();
    const client = new LangfuseClient({
      publicKey: "pk-test",
      secretKey: "sk-test",
      baseUrl: "http://localhost:3002",
    });
    // Exercise the real SDK cache and compiler; replace only the HTTP boundary.
    const get = jest.spyOn(client.api.prompts, "get").mockResolvedValue({
      name: "coreAssistantPrompt",
      version: 1,
      type: "text",
      prompt: template,
      config: {},
      tags: [],
      labels: ["production"],
    });
    Reflect.set(service, "langfuseClient", managed ? client : undefined);
    return { service, get };
  }

  afterEach(() => jest.restoreAllMocks());

  it("caches the managed template and compiles fresh per-run variables on each call", async () => {
    const { service, get } = fixture();
    const first = await service.loadPrompt("coreAssistantPrompt", vars);
    const second = await service.loadPrompt("coreAssistantPrompt", {
      interfaceLanguage: "en",
      moduleCapabilities: "{}",
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(first).toContain(`Current module capability flags: ${vars.moduleCapabilities}.`);
    expect(second).toContain("interface language (en)");
    expect(second).toContain("Current module capability flags: {}.");
    expect(second).not.toContain(vars.moduleCapabilities);
    expect(first).not.toContain("{{");
  });

  it("serves a cached template immediately during refresh and keeps it when refresh fails", async () => {
    const { service, get } = fixture();
    const first = await service.loadPrompt("coreAssistantPrompt", vars);
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 61_000);
    get.mockRejectedValue(new Error("Offline"));
    expect(await service.loadPrompt("coreAssistantPrompt", vars)).toBe(first);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("uses the same bundled template when credentials are missing or a cold fetch fails", async () => {
    const local = fixture(false);
    const expected = await local.service.loadPrompt("coreAssistantPrompt", vars);
    expect(local.get).not.toHaveBeenCalled();
    const remote = fixture();
    remote.get.mockRejectedValue(new Error("Unavailable or missing production prompt"));
    expect(await remote.service.loadPrompt("coreAssistantPrompt", vars)).toBe(expected);
    expect(expected).toContain(vars.moduleCapabilities);
    expect(expected).not.toContain("&quot;");
    expect(expected).not.toContain("{{");
  });

  it("renders identical managed and bundled instructions, including raw capability JSON", async () => {
    const remote = fixture();
    const local = fixture(false);
    expect(await remote.service.loadPrompt("coreAssistantPrompt", vars)).toBe(
      await local.service.loadPrompt("coreAssistantPrompt", vars),
    );
    for (const id of [
      "coreAssistantTutorialSearchTool",
      "coreAssistantTutorialReadTool",
    ] as const) {
      remote.get.mockResolvedValue({
        name: id,
        version: 1,
        type: "text",
        prompt: promptTemplates[id].template,
        config: {},
        tags: [],
        labels: ["production"],
      });
      expect(await remote.service.loadPrompt(id, {})).toBe(await local.service.loadPrompt(id, {}));
    }
  });
});
