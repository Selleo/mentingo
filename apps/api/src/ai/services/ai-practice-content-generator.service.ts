import { observe, updateActiveObservation } from "@langfuse/tracing";
import { Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { aiMentorPracticeContentSchema } from "src/ai/schemas/ai-practice-content.schema";
import { PromptService } from "src/ai/services/prompt.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";

import type { SupportedLanguages } from "@repo/shared";
import type { AiMentorPracticeContent } from "src/ai/schemas/ai-practice-content.schema";

type GenerateAiMentorPracticeContentInput = {
  language: SupportedLanguages;
  learnerRequest: string;
};

@Injectable()
export class AiPracticeContentGeneratorService {
  constructor(private readonly promptService: PromptService) {}

  async generate(input: GenerateAiMentorPracticeContentInput): Promise<AiMentorPracticeContent> {
    return observe(
      async () => {
        const system = await this.promptService.loadPrompt("aiMentorPracticeContentGenerator", {
          language: input.language,
        });
        const provider = await this.promptService.getOpenAI();
        const { generateText, jsonSchema, Output } = await loadAiSdk();
        const schema = jsonSchema<AiMentorPracticeContent>(() => aiMentorPracticeContentSchema);
        const generation = await generateText({
          model: provider(OPENAI_MODELS.BASIC),
          output: Output.object({ schema }),
          temperature: 0,
          system,
          prompt: input.learnerRequest,
          experimental_telemetry: { isEnabled: true },
        });
        const content = generation.output;

        if (!Value.Check(aiMentorPracticeContentSchema, content))
          throw new Error("Generator returned invalid practice content");

        updateActiveObservation({
          input: { language: input.language },
          output: content,
        });

        return content;
      },
      { name: "Generate AI Mentor Practice Content", asType: "generation" },
    )();
  }
}
