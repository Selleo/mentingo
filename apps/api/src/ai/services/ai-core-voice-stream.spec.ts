import * as aiEsm from "src/ai/utils/ai-esm";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";

import { AiService } from "./ai.service";

import type { AiCoreMentorStreamResult } from "src/ai/ai-chat.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

it("forwards partial sentence JSON through the Core voice service before the provider finishes", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const output = [{ cue: "calm", text: "The first sentence." }];
  const textStream = (async function* () {
    yield '{"elements":[{"cue":"calm","text":"The first';
    await gate;
    yield ' sentence."}]}';
  })();
  const sdkResult = {
    textStream,
    output: Promise.resolve(output),
    get elementStream() {
      throw new Error("The complete-element stream would delay speech");
    },
  };
  const streamText = jest.fn().mockReturnValue(sdkResult);
  const spy = jest.spyOn(aiEsm, "loadAiSdk").mockResolvedValue({
    streamText,
    Output: { array: jest.fn() },
    jsonSchema: jest.fn(),
  } as never);
  const service = new AiService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getOpenAI: jest.fn().mockResolvedValue(jest.fn()) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  try {
    const result: AiCoreMentorStreamResult = await service["streamCoreMentorChat"]({
      data: { threadId: "thread-1", content: "Learner answer" },
      model: OPENAI_MODELS.VOICE,
      currentUser: { userId: "user-1", tenantId: "tenant-1" } as CurrentUserType,
      isVoiceMentor: true,
      prompt: [],
      generationConfig: { temperature: 0.2, topK: 20, topP: 0.5 },
      persistOnFinish: false,
    });
    const iterator = result.textStream[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toBe("⟦cue:calm⟧The first");
    release?.();
    expect((await iterator.next()).value).toBe(" sentence. ");
    expect((await iterator.next()).done).toBe(true);
  } finally {
    release?.();
    spy.mockRestore();
  }
});
