import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiService } from "src/ai/services/ai.service";
import { OPENAI_MODELS, THREAD_STATUS } from "src/ai/utils/ai.type";

import type { CurrentUserType } from "src/common/types/current-user.type";

const user = { userId: "user-1", tenantId: "tenant-1" } as CurrentUserType;

describe("Voice stream persistence", () => {
  it.each(["complete", "cancel-before-delta", "cancel-before-persist"])(
    "handles %s without saving a cancelled turn",
    async (mode) => {
      const controller = new AbortController();
      const createMessages = jest.fn().mockResolvedValue(undefined);
      const source = (async function* () {
        if (mode === "cancel-before-delta") controller.abort();
        yield "Mentor reply";
        if (mode === "cancel-before-persist") controller.abort();
      })();
      const service = new AiService(
        {} as never,
        { countTokens: jest.fn().mockReturnValue(2) } as never,
        {
          findThread: jest.fn().mockResolvedValue({
            id: "thread-1",
            userId: user.userId,
            practiceSessionId: "practice-1",
            status: THREAD_STATUS.ACTIVE,
          }),
        } as never,
        {} as never,
        { createMessages } as never,
        { buildPrompt: jest.fn().mockResolvedValue([]) } as never,
        { summarizeThreadOnTokenThreshold: jest.fn() } as never,
        {} as never,
        {
          streamMentorChat: jest
            .fn()
            .mockResolvedValue({ source: AI_RUNTIME_SOURCES.LUMA, textStream: source }),
        } as never,
        {} as never,
        {} as never,
        { runWithTenant: async (_id: string, run: () => Promise<void>) => run() } as never,
        {} as never,
      );
      const result = await service.streamMessage(
        {
          threadId: "thread-1",
          content: "Learner answer",
          abortSignal: controller.signal,
        },
        OPENAI_MODELS.VOICE,
        user,
        true,
      );
      const deltas: string[] = [];
      for await (const delta of result.textStream) deltas.push(delta);
      if (mode === "complete") {
        expect(deltas).toEqual(["Mentor reply"]);
        expect(createMessages).toHaveBeenCalledWith(
          expect.objectContaining({ threadId: "thread-1", content: "Learner answer" }),
          expect.objectContaining({ threadId: "thread-1", content: "Mentor reply" }),
        );
      } else {
        expect(createMessages).not.toHaveBeenCalled();
      }
    },
  );
});
