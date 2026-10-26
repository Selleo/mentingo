import { AiService } from "src/ai/services/ai.service";
import { ChatService } from "src/ai/services/chat.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";

jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn() }));

const promptService = {
  isNotEmpty: jest.fn(),
  getOpenAI: jest.fn().mockResolvedValue((model: string) => model),
};

describe("Core Mentor model settings", () => {
  const generateText = jest.fn().mockResolvedValue({ text: "Hello" });
  const generateObject = jest.fn().mockResolvedValue({ object: { score: 1 } });
  const streamText = jest.fn().mockReturnValue({ textStream: {} });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadAiSdk).mockResolvedValue({
      generateText,
      generateObject,
      jsonSchema: jest.fn(),
      Output: { array: jest.fn().mockReturnValue({ type: "array" }) },
      streamText,
    } as never);
  });

  it("defaults every text generation role to Luna", () => {
    expect(OPENAI_MODELS.BASIC).toBe("gpt-6-luna");
    expect(OPENAI_MODELS.TRANSLATION).toBe("gpt-6-luna");
    expect(OPENAI_MODELS.MENTOR).toBe("gpt-6-luna");
    expect(OPENAI_MODELS.VOICE).toBe("gpt-6-luna");
  });

  it("uses low reasoning for Mentor welcomes and summaries", async () => {
    const service = new ChatService(promptService as never);
    await service.generatePrompt("Welcome", OPENAI_MODELS.MENTOR, "Stay in character");
    const mentorRequest = generateText.mock.calls[0][0];
    expect(mentorRequest.model).toBe("gpt-6-luna");
    expect(mentorRequest.providerOptions).toEqual({
      openai: { reasoningEffort: "low", forceReasoning: true },
    });
    expect(mentorRequest).not.toHaveProperty("temperature");
    await service.generatePrompt("Summarize");
    expect(generateText.mock.calls[1][0].model).toBe("gpt-6-luna");
    expect(generateText.mock.calls[1][0].providerOptions).toEqual({
      openai: { reasoningEffort: "low", forceReasoning: true },
    });
  });

  it("judges with Luna medium reasoning and no incompatible sampling controls", async () => {
    const service = new ChatService(promptService as never);
    await service.judge("Rubric", "Answer");
    const request = generateObject.mock.calls[0][0];
    expect(request.model).toBe("gpt-6-luna");
    expect(request.providerOptions).toEqual({
      openai: { reasoningEffort: "medium", forceReasoning: true },
    });
    for (const key of ["temperature", "topP", "topK"]) {
      expect(request).not.toHaveProperty(key);
    }
  });

  it.each([
    { model: OPENAI_MODELS.MENTOR, isVoiceMentor: false },
    { model: OPENAI_MODELS.VOICE, isVoiceMentor: true },
  ])(
    "streams voice=$isVoiceMentor with explicit reasoning and without unsupported sampling controls",
    async ({ model, isVoiceMentor }) => {
      const service = new AiService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        promptService as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await service["streamCoreMentorChat"]({
        data: { threadId: "thread", content: "Question" } as never,
        model,
        currentUser: {} as never,
        isVoiceMentor,
        prompt: [
          { role: "system", content: "Stay in character" },
          { role: "user", content: "Question" },
        ],
        generationConfig: { temperature: 0.2, topP: 0.5, topK: 20 },
        persistOnFinish: false,
      });
      const request = streamText.mock.calls[0][0];
      expect(request.model).toBe("gpt-6-luna");
      expect(request.providerOptions).toEqual({
        openai: { reasoningEffort: "low", forceReasoning: true },
      });
      for (const key of ["temperature", "topP", "topK"]) {
        expect(request).not.toHaveProperty(key);
      }
    },
  );
  it.each(["complete", "invalid-tail", "cancel"])(
    "persists only a completed native voice reply: %s",
    async (mode) => {
      const abort = new AbortController();
      const createMessages = jest.fn();
      streamText.mockReturnValueOnce({
        elementStream: (async function* () {
          yield { cue: "frustrated", text: "Still waiting." };
          if (mode === "cancel") abort.abort();
          yield { cue: "frustrated", text: "Who can help?" };
        })(),
        get output() {
          return mode === "invalid-tail"
            ? Promise.reject(new Error("invalid tail"))
            : Promise.resolve([]);
        },
      } as never);
      const service = new AiService(
        {} as never,
        { countTokens: () => 1 } as never,
        {} as never,
        {} as never,
        { createMessages } as never,
        promptService as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        { runWithTenant: async (_id: string, run: () => Promise<void>) => run() } as never,
        {} as never,
        {} as never,
      );
      const response = await service["streamCoreMentorChat"]({
        data: { threadId: "thread", content: "Sorry.", abortSignal: abort.signal } as never,
        model: OPENAI_MODELS.VOICE,
        currentUser: { userId: "user", tenantId: "tenant" } as never,
        isVoiceMentor: true,
        prompt: [{ role: "user", content: "Sorry." }],
        generationConfig: { temperature: 0.2, topP: 0.5, topK: 20 },
        persistOnFinish: true,
      });
      const collect = async () => {
        const parts = [];
        for await (const part of response.textStream) parts.push(part);
        return parts;
      };
      if (mode === "invalid-tail") {
        await expect(collect()).rejects.toThrow("invalid tail");
      } else {
        const parts = await collect();
        expect(parts[0]).toBe("⟦cue:frustrated⟧Still waiting. ");
      }
      if (mode === "complete") {
        expect(createMessages).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ content: "Still waiting. Who can help? " }),
        );
      } else expect(createMessages).not.toHaveBeenCalled();
      expect(streamText.mock.calls[0][0]).toHaveProperty("output");
    },
  );
});
