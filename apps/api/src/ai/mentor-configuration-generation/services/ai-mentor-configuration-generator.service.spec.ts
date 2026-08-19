import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { loadAiSdk } from "src/ai/utils/ai-esm";

import { AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE } from "../ai-mentor-configuration-generation.constants";

import { AiMentorConfigurationGeneratorService } from "./ai-mentor-configuration-generator.service";

import type { PromptService } from "src/ai/services/prompt.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));
jest.mock("src/ai/utils/ai-esm", () => ({ loadAiSdk: jest.fn() }));

const lessonContext = {
  title: "Handle a price objection",
  taskDescription: "Reach an agreed next step.",
};

const teacherFields = {
  taskGoal: "Help the learner uncover customer needs.",
  expertise: "Consultative sales",
  contentScope: "Discovery questions and active listening.",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
  feedbackGuidance: null,
  openingInstruction: null,
  additionalInstructions: null,
};

const roleplayFields = {
  scenario: "A buyer challenges the proposal price.",
  aiRole: "Skeptical buyer",
  learnerRole: "Sales representative",
  characterGoal: "Understand whether the proposal justifies its price.",
  difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
  factsAndConstraints: null,
  openingInstruction: null,
  additionalInstructions: null,
};

const readPayload = (prompt: string) => {
  const [, json] = prompt.match(/<input_json>\n(.+)\n<\/input_json>/s) ?? [];
  if (!json) throw new Error("Missing input JSON");
  return JSON.parse(json);
};

describe("AiMentorConfigurationGeneratorService", () => {
  const createService = (output: object) => {
    const generateText = jest.fn().mockResolvedValue({ output });
    jest.mocked(loadAiSdk).mockResolvedValue({
      generateText,
      jsonSchema: jest.fn((schema) => schema),
      Output: { object: jest.fn((options) => options) },
    } as never);
    const promptService = {
      loadPrompt: jest.fn(async (id: string) =>
        id === "aiMentorConfigurationGeneratorBase"
          ? "BASE"
          : id === "aiMentorConfigurationGeneratorPractice"
            ? "The learner's brief describes what the learner wants to practise"
            : `MODE:${id}`,
      ),
      isNotEmpty: jest.fn().mockResolvedValue(undefined),
      getOpenAI: jest.fn().mockResolvedValue(jest.fn().mockReturnValue("MODEL")),
    };
    const service = new AiMentorConfigurationGeneratorService(
      promptService as unknown as PromptService,
    );

    return { generateText, promptService, service };
  };

  it("uses the creator-selected Teacher type without asking the model to return it", async () => {
    const { generateText, service } = createService(teacherFields);

    const result = await service.generate({
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
      configurationType: AI_MENTOR_TYPE.TEACHER,
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      brief: "Create a guided sales Teacher.",
    });

    const [{ prompt, providerOptions }] = generateText.mock.calls[0];
    expect(readPayload(prompt)).toEqual({
      configurationType: AI_MENTOR_TYPE.TEACHER,
      creatorBrief: "Create a guided sales Teacher.",
      lessonContext,
    });
    expect(providerOptions).toEqual({ openai: { reasoningEffort: "medium" } });
    expect(result).toEqual({ type: AI_MENTOR_TYPE.TEACHER, ...teacherFields });
    expect(generateText.mock.calls[0][0].output.schema()).not.toHaveProperty("properties.type");
  });

  it("uses the manually changed Roleplay type and current unsaved values for improve", async () => {
    const { generateText, service } = createService(roleplayFields);
    const currentConfiguration = {
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "",
      aiRole: "Buyer",
      learnerRole: "Sales representative",
    };

    const result = await service.generate({
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
      configurationType: AI_MENTOR_TYPE.ROLEPLAY,
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      instruction: "Complete the remaining Roleplay fields.",
      currentConfiguration,
    });

    const [{ prompt }] = generateText.mock.calls[0];
    expect(readPayload(prompt)).toEqual({
      configurationType: AI_MENTOR_TYPE.ROLEPLAY,
      creatorInstruction: "Complete the remaining Roleplay fields.",
      lessonContext,
      currentConfiguration,
    });
    expect(result).toEqual({ type: AI_MENTOR_TYPE.ROLEPLAY, ...roleplayFields });
  });

  it("adds learner-intent role direction for standalone practice generation", async () => {
    const { generateText, promptService, service } = createService(roleplayFields);

    await service.generate({
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
      configurationType: AI_MENTOR_TYPE.ROLEPLAY,
      language: SUPPORTED_LANGUAGES.EN,
      lessonContext,
      brief: "I want to learn how to handle a difficult client.",
      generationPurpose: AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE.STANDALONE_PRACTICE,
    });

    expect(promptService.loadPrompt).toHaveBeenCalledWith(
      "aiMentorConfigurationGeneratorPractice",
      {},
    );
    expect(generateText.mock.calls[0][0].system).toContain(
      "The learner's brief describes what the learner wants to practise",
    );
  });

  it("rejects model output that tries to return a type", async () => {
    const { service } = createService({
      type: AI_MENTOR_TYPE.TEACHER,
      ...teacherFields,
    });

    await expect(
      service.generate({
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
        configurationType: AI_MENTOR_TYPE.TEACHER,
        language: SUPPORTED_LANGUAGES.EN,
        lessonContext,
        brief: "Create a Teacher.",
      }),
    ).rejects.toThrow("invalid configuration structure");
  });
});
