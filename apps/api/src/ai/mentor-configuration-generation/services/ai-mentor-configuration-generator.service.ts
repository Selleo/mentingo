import { observe, updateActiveObservation } from "@langfuse/tracing";
import { Injectable } from "@nestjs/common";
import { AI_MENTOR_CONFIGURATION_GENERATION_MODE, AI_MENTOR_TYPE } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { PromptService } from "src/ai/services/prompt.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { AI_TELEMETRY_FUNCTION_IDS, buildAiTelemetry } from "src/ai/utils/ai-telemetry";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";

import {
  AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE,
  AI_MENTOR_CONFIGURATION_GENERATION_MODE_PROMPT_ID,
  AI_MENTOR_CONFIGURATION_GENERATOR_REASONING_EFFORT,
} from "../ai-mentor-configuration-generation.constants";
import {
  generatedAiMentorRoleplayConfigurationFieldsSchema,
  generatedAiMentorTeacherConfigurationFieldsSchema,
} from "../schemas/ai-mentor-configuration-generation.schema";
import {
  attachAiMentorRoleplayConfiguration,
  attachAiMentorTeacherConfiguration,
} from "../utils/ai-mentor-configuration-draft";
import { buildAiMentorConfigurationGeneratorPrompt } from "../utils/ai-mentor-configuration-prompts";
import { preserveAiMentorRepairScope } from "../utils/ai-mentor-configuration-repair";

import type { GenerateAiMentorConfigurationDraftInput } from "./ai-mentor-configuration-generator.types";
import type {
  GeneratedAiMentorRoleplayConfigurationFields,
  GeneratedAiMentorTeacherConfigurationFields,
} from "../schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

@Injectable()
export class AiMentorConfigurationGeneratorService {
  constructor(
    private readonly promptService: PromptService,
    private readonly aiRuntimeService: AiRuntimeService,
  ) {}

  async generate(
    input: GenerateAiMentorConfigurationDraftInput,
  ): Promise<AiMentorConfigurationContent> {
    return observe(
      async () => {
        const [basePrompt, modePrompt, purposePrompt] = await Promise.all([
          this.promptService.loadPrompt("aiMentorConfigurationGeneratorBase", {
            language: input.language,
          }),
          this.promptService.loadPrompt(
            AI_MENTOR_CONFIGURATION_GENERATION_MODE_PROMPT_ID[input.mode],
            {},
          ),
          input.generationPurpose === AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE.STANDALONE_PRACTICE
            ? this.promptService.loadPrompt("aiMentorConfigurationGeneratorPractice", {})
            : Promise.resolve(""),
        ]);
        const system = [basePrompt, modePrompt, purposePrompt].filter(Boolean).join("\n\n");
        const prompt = buildAiMentorConfigurationGeneratorPrompt(input);
        const generatedConfiguration =
          input.configurationType === AI_MENTOR_TYPE.TEACHER
            ? attachAiMentorTeacherConfiguration(await this.generateTeacherFields(system, prompt))
            : attachAiMentorRoleplayConfiguration(
                await this.generateRoleplayFields(system, prompt),
              );

        const configuration =
          input.mode === AI_MENTOR_CONFIGURATION_GENERATION_MODE.REPAIR
            ? preserveAiMentorRepairScope(
                input.currentConfiguration,
                generatedConfiguration,
                input.blockingIssues,
              )
            : generatedConfiguration;

        updateActiveObservation({
          input: {
            mode: input.mode,
            language: input.language,
            configurationType: input.configurationType,
            system,
            prompt,
          },
          output: configuration,
        });

        return configuration;
      },
      { name: "Generate AI Mentor Configuration Draft", asType: "generation" },
    )();
  }

  private async generateTeacherFields(
    system: string,
    prompt: string,
  ): Promise<GeneratedAiMentorTeacherConfigurationFields> {
    await this.promptService.isNotEmpty(prompt);

    try {
      const result = await this.aiRuntimeService.generateMentorConfiguration(
        {
          configurationType: AI_MENTOR_TYPE.TEACHER,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0,
        },
        () => this.generateCoreTeacherFields(system, prompt),
      );
      if (!Value.Check(generatedAiMentorTeacherConfigurationFieldsSchema, result))
        throw new Error("Generator returned an invalid configuration structure");
      return result as GeneratedAiMentorTeacherConfigurationFields;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updateActiveObservation({ level: "ERROR", statusMessage: message });
      throw new Error(`Failed to generate AI Mentor configuration: ${message}`);
    }
  }

  private async generateRoleplayFields(
    system: string,
    prompt: string,
  ): Promise<GeneratedAiMentorRoleplayConfigurationFields> {
    await this.promptService.isNotEmpty(prompt);

    try {
      const result = await this.aiRuntimeService.generateMentorConfiguration(
        {
          configurationType: AI_MENTOR_TYPE.ROLEPLAY,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0,
        },
        () => this.generateCoreRoleplayFields(system, prompt),
      );
      if (!Value.Check(generatedAiMentorRoleplayConfigurationFieldsSchema, result))
        throw new Error("Generator returned an invalid configuration structure");
      return result as GeneratedAiMentorRoleplayConfigurationFields;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updateActiveObservation({ level: "ERROR", statusMessage: message });
      throw new Error(`Failed to generate AI Mentor configuration: ${message}`);
    }
  }

  private async generateCoreTeacherFields(
    system: string,
    prompt: string,
  ): Promise<GeneratedAiMentorTeacherConfigurationFields> {
    const provider = await this.promptService.getOpenAI();
    const { generateText, jsonSchema, Output } = await loadAiSdk();
    const schema = jsonSchema<GeneratedAiMentorTeacherConfigurationFields>(
      () => generatedAiMentorTeacherConfigurationFieldsSchema,
    );
    const generation = await generateText({
      model: provider(OPENAI_MODELS.BASIC),
      output: Output.object({ schema }),
      providerOptions: {
        openai: {
          reasoningEffort: AI_MENTOR_CONFIGURATION_GENERATOR_REASONING_EFFORT,
          forceReasoning: true,
        },
      },
      system,
      prompt,
      telemetry: buildAiTelemetry(AI_TELEMETRY_FUNCTION_IDS.AI_MENTOR_CONFIGURATION_GENERATION),
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
  }

  private async generateCoreRoleplayFields(
    system: string,
    prompt: string,
  ): Promise<GeneratedAiMentorRoleplayConfigurationFields> {
    const provider = await this.promptService.getOpenAI();
    const { generateText, jsonSchema, Output } = await loadAiSdk();
    const schema = jsonSchema<GeneratedAiMentorRoleplayConfigurationFields>(
      () => generatedAiMentorRoleplayConfigurationFieldsSchema,
    );
    const generation = await generateText({
      model: provider(OPENAI_MODELS.BASIC),
      output: Output.object({ schema }),
      providerOptions: {
        openai: {
          reasoningEffort: AI_MENTOR_CONFIGURATION_GENERATOR_REASONING_EFFORT,
          forceReasoning: true,
        },
      },
      system,
      prompt,
      telemetry: buildAiTelemetry(AI_TELEMETRY_FUNCTION_IDS.AI_MENTOR_CONFIGURATION_GENERATION),
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
  }
}
