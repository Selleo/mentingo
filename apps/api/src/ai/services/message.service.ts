import { Injectable } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";

import type { ResponseChatWithMentorBody, ThreadMessageBody } from "src/ai/utils/ai.schema";
import type { MessageRole } from "src/ai/utils/ai.type";
import type { UUIDType } from "src/common";

@Injectable()
export class MessageService {
  constructor(private readonly aiRepository: AiRepository) {}
  async createMessages(studentMessage: ThreadMessageBody, mentorMessage: ThreadMessageBody) {
    const studentMessageWithId = await this.aiRepository.createMessage(studentMessage);
    const mentorMessageWithId = await this.aiRepository.createMessage(mentorMessage);
    return { studentMessageWithId, mentorMessageWithId };
  }

  async findMessageHistory(threadId: UUIDType, archived?: boolean, role?: MessageRole) {
    const history = await this.aiRepository.findMessageHistory(threadId, archived, role);
    const language = await this.aiRepository.findThreadLanguage(threadId);
    return { history, language };
  }

  async insertMessage(messageData: ThreadMessageBody) {
    return this.aiRepository.insertMessage(messageData);
  }

  async parseMentorResponse(data: ResponseChatWithMentorBody): Promise<string> {
    return data.isJudge ? JSON.parse(data.content)["summary"] : data.content;
  }
}
