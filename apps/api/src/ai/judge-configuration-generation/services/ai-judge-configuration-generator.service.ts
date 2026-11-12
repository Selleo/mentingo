import { observe, updateActiveObservation } from "@langfuse/tracing";
import { Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { PromptService } from "src/ai/services/prompt.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { AI_TELEMETRY_FUNCTION_IDS, buildAiTelemetry } from "src/ai/utils/ai-telemetry";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";

import {
  AI_JUDGE_GENERATION_MODE_PROMPT_ID,
  AI_JUDGE_CONFIGURATION_GENERATOR_REASONING_EFFORT,
} from "../ai-judge-configuration-generation.constants";
import { AI_JUDGE_GENERATION_MODE } from "../ai-judge-configuration-generation.types";
import { referencedAiJudgeConfigurationStructuredOutputSchema } from "../schemas/ai-judge-configuration-generation.schema";
import { buildAiJudgeConfigurationGeneratorPrompt } from "../utils/ai-judge-configuration-prompts";
import {
  preserveAiJudgeRepairScope,
  normalizeGeneratedAiJudgeConfiguration,
} from "../utils/ai-judge-configuration-repair";

import type { GenerateAiJudgeConfigurationDraftInput } from "./ai-judge-configuration-generator.types";
import type { ReferencedAiJudgeConfiguration } from "../schemas/ai-judge-configuration-generation.schema";

@Injectable()
export class AiJudgeConfigurationGeneratorService {
  constructor(
    private readonly promptService: PromptService,
    private readonly aiRuntimeService: AiRuntimeService,
  ) {}

  async generate(
    input: GenerateAiJudgeConfigurationDraftInput,
  ): Promise<ReferencedAiJudgeConfiguration> {
    return observe(
      async () => {
        const [basePrompt, modePrompt] = await Promise.all([
          this.promptService.loadPrompt("aiJudgeConfigurationGeneratorBase", {
            language: input.language,
          }),
          this.promptService.loadPrompt(AI_JUDGE_GENERATION_MODE_PROMPT_ID[input.mode], {}),
        ]);
        const system = `${basePrompt}\n\n${modePrompt}`;
        const prompt = buildAiJudgeConfigurationGeneratorPrompt(input);
        const generatedConfiguration = await this.generateConfiguration(system, prompt);
        const configuration =
          input.mode === AI_JUDGE_GENERATION_MODE.REPAIR
            ? preserveAiJudgeRepairScope(
                input.currentConfiguration,
                generatedConfiguration,
                input.blockingIssues,
              )
            : generatedConfiguration;

        updateActiveObservation({
          input: { mode: input.mode, language: input.language, system, prompt },
          output: configuration,
        });

        return configuration;
      },
      { name: "Generate AI Judge Configuration Draft", asType: "generation" },
    )();
  }

  private async generateConfiguration(
    system: string,
    prompt: string,
  ): Promise<ReferencedAiJudgeConfiguration> {
    await this.promptService.isNotEmpty(prompt);

    try {
      const result = await this.aiRuntimeService.generateJudgeConfiguration(
        {
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0,
        },
        async () => {
          const provider = await this.promptService.getOpenAI();
          const { generateText, jsonSchema, Output } = await loadAiSdk();
          const schema = jsonSchema<ReferencedAiJudgeConfiguration>(
            () => referencedAiJudgeConfigurationStructuredOutputSchema,
          );

          const generation = await generateText({
            model: provider(OPENAI_MODELS.BASIC),
            output: Output.object({ schema }),
            providerOptions: {
              openai: {
                reasoningEffort: AI_JUDGE_CONFIGURATION_GENERATOR_REASONING_EFFORT,
                forceReasoning: true,
              },
            },
            system,
            prompt,
            telemetry: buildAiTelemetry(
              AI_TELEMETRY_FUNCTION_IDS.AI_JUDGE_CONFIGURATION_GENERATION,
            ),
          });

          try {
            return generation.output;
          } catch (error) {
            const outputTokens = generation.usage.outputTokens ?? "unknown";
            const message = error instanceof Error ? error.message : "No structured output";
            throw new Error(
              `${message} Finish reason: ${generation.finishReason}; output tokens: ${outputTokens}.`,
            );
          }
        },
      );

      if (!Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, result))
        throw new Error("Generator returned an invalid configuration structure");

      return normalizeGeneratedAiJudgeConfiguration(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updateActiveObservation({ level: "ERROR", statusMessage: message });
      throw new Error(`Failed to generate AI Judge configuration: ${message}`);
    }
  }
}
