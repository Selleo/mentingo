import { observe, updateActiveObservation } from "@langfuse/tracing";
import { Injectable } from "@nestjs/common";

import { MAX_TOKENS } from "src/ai/ai.constants";
import { PromptService } from "src/ai/services/prompt.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { aiJudgeJudgementSchema } from "src/ai/utils/ai.schema";
import { OPENAI_MODELS, type OpenAIModels } from "src/ai/utils/ai.type";

import type { AiJudgeModelResult } from "src/ai/judge-configuration/judge-configuration.types";

@Injectable()
export class ChatService {
  constructor(private readonly promptService: PromptService) {}
  async generatePrompt(
    prompt: string,
    model: OpenAIModels = OPENAI_MODELS.BASIC,
    systemPrompt?: string,
  ): Promise<string> {
    return observe(
      async () => {
        await this.promptService.isNotEmpty(prompt);
        const provider = await this.promptService.getOpenAI();

        try {
          const { generateText } = await loadAiSdk();
          const { text } = await generateText({
            model: provider(model),
            system: systemPrompt,
            prompt: prompt,
            maxOutputTokens: MAX_TOKENS,
            experimental_telemetry: { isEnabled: true },
          });

          return text;
        } catch (error) {
          throw new Error(
            `Failed to generate message: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }
      },
      { name: "Generate Prompt", asType: "generation" },
    )();
  }

  async judge(system: string, prompt: string): Promise<AiJudgeModelResult> {
    return observe(
      async () => {
        await this.promptService.isNotEmpty(prompt);
        const provider = await this.promptService.getOpenAI();
        try {
          const { generateObject, jsonSchema } = await loadAiSdk();
          const result = await generateObject({
            model: provider(OPENAI_MODELS.BASIC),
            schema: jsonSchema(() => aiJudgeJudgementSchema),
            temperature: 0.2,
            topK: 10,
            topP: 0.9,
            system,
            prompt,
            experimental_telemetry: { isEnabled: true },
          });

          const judged = result.object as AiJudgeModelResult;
          updateActiveObservation({ input: { system, prompt }, output: judged });

          return judged;
        } catch (error) {
          updateActiveObservation({
            level: "ERROR",
            statusMessage: error instanceof Error ? error.message : "Unknown error",
          });
          throw new Error(`Failed to generate result ${error}`);
        }
      },
      { name: "Generate Evaluation", asType: "generation" },
    )();
  }
}
