import { faker } from "@faker-js/faker";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Factory } from "fishery";

import { MESSAGE_ROLE, THREAD_STATUS } from "src/ai/utils/ai.type";
import { aiMentorJudgements, aiMentorThreadMessages, aiMentorThreads } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type AiMentorThreadTest = Omit<InferInsertModel<typeof aiMentorThreads>, "tenantId">;

type AiMentorThreadTransientParams = { mentorMessage?: string };

class AiMentorThreadFactory extends Factory<
  AiMentorThreadTest,
  AiMentorThreadTransientParams,
  InferSelectModel<typeof aiMentorThreads>
> {
  /** Also stores an opening message from the mentor in the thread. */
  withMentorMessage(content: string) {
    return this.transient({ mentorMessage: content });
  }
}

export const createAiMentorThreadFactory = (db: DatabasePg) =>
  AiMentorThreadFactory.define(({ onCreate, transientParams }) => {
    onCreate(async (thread) => {
      const [inserted] = await db.insert(aiMentorThreads).values(thread).returning();

      if (transientParams.mentorMessage) {
        await db.insert(aiMentorThreadMessages).values({
          threadId: inserted.id,
          role: MESSAGE_ROLE.MENTOR,
          content: transientParams.mentorMessage,
          tokenCount: 4,
        });
      }

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      userId: "",
      aiMentorLessonId: null,
      status: THREAD_STATUS.ACTIVE,
      userLanguage: SUPPORTED_LANGUAGES.EN,
    };
  });

export type AiMentorJudgementTest = Omit<InferInsertModel<typeof aiMentorJudgements>, "tenantId">;

export const createAiMentorJudgementFactory = (db: DatabasePg) =>
  Factory.define<AiMentorJudgementTest, never, InferSelectModel<typeof aiMentorJudgements>>(
    ({ onCreate }) => {
      onCreate(async (judgement) => {
        const [inserted] = await db.insert(aiMentorJudgements).values(judgement).returning();

        return inserted;
      });

      return {
        id: faker.string.uuid(),
        threadId: "",
        configurationId: "",
        language: SUPPORTED_LANGUAGES.EN,
        earnedPoints: 1,
        maxScore: 1,
        percentage: 100,
        passed: true,
      };
    },
  );
