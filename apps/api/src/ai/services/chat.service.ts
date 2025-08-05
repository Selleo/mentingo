import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { generateObject, generateText, jsonSchema } from "ai";

import { MAX_TOKENS } from "src/ai/ai.constants";
import { PromptService } from "src/ai/services/prompt.service";
import {
  type AiJudgeJudgementBody,
  aiJudgeJudgementSchema,
  type ResponseAiJudgeJudgementBody,
} from "src/ai/utils/ai.schema";
import { OPENAI_MODELS, type OpenAIModels } from "src/ai/utils/ai.type";

@Injectable()
export class ChatService {
  constructor(private readonly promptService: PromptService) {}
  async generatePrompt(prompt: string, model: OpenAIModels = OPENAI_MODELS.BASIC): Promise<string> {
    await this.promptService.isNotEmpty(prompt);

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

  async judge(system: string, prompt: string) {
    await this.promptService.isNotEmpty(prompt);

    try {
      const result = await generateObject({
        model: openai(OPENAI_MODELS.BASIC, { structuredOutputs: true }),
        schema: jsonSchema({ ...aiJudgeJudgementSchema, additionalProperties: false }),
        temperature: 0.5,
        topK: 10,
        topP: 0.9,
        system,
        prompt,
      });

      return await this.evaluate(result.object as AiJudgeJudgementBody);
    } catch (error) {
      throw new Error(`Failed to generate result ${error}`);
    }
  }

  private async evaluate(result: AiJudgeJudgementBody): Promise<ResponseAiJudgeJudgementBody> {
    const passed = result.score >= result.minScore;

    if (result.score === result.maxScore) {
      return { ...result, percentage: 100, passed };
    }

    const percentage = result.maxScore > 0 ? Math.ceil((result.score / result.maxScore) * 100) : 0;

    return { ...result, percentage, passed };
  }
}
