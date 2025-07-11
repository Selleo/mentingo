import { openai } from "@ai-sdk/openai";
import { BadRequestException, forwardRef, Inject, Injectable } from "@nestjs/common";
import { generateObject, generateText, jsonSchema, type Message } from "ai";

import { AiService } from "src/ai/services/ai.service";
import { MAX_TOKENS } from "src/ai/utils/ai.config";
import {
  type AiJudgeJudgementBody,
  aiJudgeJudgementSchema,
  type ResponseAiJudgeJudgementBody,
} from "src/ai/utils/ai.schema";
import { judge } from "src/ai/utils/ai.tools";
import {
  MESSAGE_ROLE,
  type MessageRole,
  OPENAI_MODELS,
  type OpenAIModels,
} from "src/ai/utils/ai.type";

@Injectable()
export class ChatService {
  constructor(@Inject(forwardRef(() => AiService)) private readonly aiService: AiService) {}
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
      const result = await generateText({
        model: openai(model),
        messages: messages.map((m) => ({
          ...m,
          role: this.mapRole(m.role),
        })) as Omit<Message, "id">[],
        maxTokens: MAX_TOKENS,
        tools: {
          judge: judge(this.aiService),
        },
      });
      if (!result.text && result.toolCalls?.length) {
        const toolResults = result.toolResults
          ?.map((tr) => JSON.stringify(tr.result.data))
          .join("\n");

        return toolResults;
      }
      return result.text;
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
      throw new BadRequestException("Prompt cannot be empty");
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
