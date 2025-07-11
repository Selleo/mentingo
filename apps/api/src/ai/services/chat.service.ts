import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { generateObject, generateText, jsonSchema, type Message } from "ai";

import { MAX_TOKENS } from "src/ai/ai.config";
import {
  type AiJudgeJudgementBody,
  aiJudgeJudgementSchema,
  type ResponseAiJudgeJudgementBody,
} from "src/ai/ai.schema";
import { MESSAGE_ROLE, type MessageRole, OPENAI_MODELS, type OpenAIModels } from "src/ai/ai.type";

@Injectable()
export class ChatService {
  async generatePrompt(prompt: string, model: OpenAIModels): Promise<string> {
    if (!prompt?.trim()) {
      throw new Error("Prompt cannot be empty");
    }
    try {
      const { text } = await generateText({
        model: openai(model),
        prompt: prompt,
        maxTokens: MAX_TOKENS,
      });
      return text;
    } catch (error) {
      throw new Error(
        `Failed to generate message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async chatWithMentor(
    messages: Array<{ role: MessageRole; content: string }>,
    model: OpenAIModels,
  ): Promise<string> {
    if (!messages?.length) {
      throw new Error("Messages array cannot be empty");
    }

    try {
      const { text } = await generateText({
        model: openai(model),
        messages: messages.map((m) => ({
          ...m,
          role: this.mapRole(m.role),
        })) as Omit<Message, "id">[],
        maxTokens: MAX_TOKENS,
      });
      return text;
    } catch (error) {
      throw new Error(
        `Failed to generate chat message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async judge(system: string, prompt: string) {
    if (!prompt?.length) {
      throw new Error("Prompt cannot be empty");
    }

    try {
      const result = await generateObject({
        model: openai(OPENAI_MODELS.BASIC, { structuredOutputs: true }),
        schema: jsonSchema({ ...aiJudgeJudgementSchema, additionalProperties: false }),
        system,
        prompt,
      });
      return await this.evaluate(result.object as AiJudgeJudgementBody);
    } catch (error) {
      throw new Error(`Failed to generate result ${error}`);
    }
  }

  private async evaluate(result: AiJudgeJudgementBody): Promise<ResponseAiJudgeJudgementBody> {
    const percentage = Math.ceil((result.score / result.maxScore) * 100);
    const passed = result.score >= result.minScore;

    return { ...result, percentage, passed };
  }

  private mapRole(role: MessageRole) {
    return role === MESSAGE_ROLE.SUMMARY ? MESSAGE_ROLE.SYSTEM : role;
  }
}
