import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { aiMentorThreads } from "src/storage/schema";

import type { ThreadMessageBody } from "src/ai/utils/ai.schema";
import type { MessageRole } from "src/ai/utils/ai.type";
import type { UUIDType } from "src/common";

@Injectable()
export class MessageService {
  constructor(private readonly aiRepository: AiRepository) {}
  async createMessages(studentMessage: ThreadMessageBody, mentorMessage: ThreadMessageBody) {
    const studentMessageWithId = await this.aiRepository.insertMessage(studentMessage);
    const mentorMessageWithId = await this.aiRepository.insertMessage(mentorMessage);
    return { studentMessageWithId, mentorMessageWithId };
  }

  async findMessageHistory(threadId: UUIDType, archived?: boolean, role?: MessageRole) {
    const history = await this.aiRepository.findMessageHistory(threadId, archived, role);
    const { userLanguage } = await this.aiRepository.findThread([eq(aiMentorThreads.id, threadId)]);
    return { history, userLanguage };
  }
}
