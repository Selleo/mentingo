import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AiJudgeConfigurationGeneratorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generator.service";
import { AiJudgeConfigurationValidatorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-validator.service";
import { AiMentorConfigurationGeneratorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generator.service";
import { AiMentorConfigurationValidatorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-validator.service";

import { prepareFeaturePrompt, runFeatureTask } from "./feature-task";

import type { FeatureCatalogue, FeatureItem, FeatureModelRequest } from "./feature-catalogue.types";
import type { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import type { PromptService } from "src/ai/services/prompt.service";

jest.mock("@langfuse/tracing", () => ({
  observe: (callback: () => unknown) => callback,
  updateActiveObservation: jest.fn(),
}));

const catalogue = JSON.parse(
  readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8"),
) as FeatureCatalogue;
const cases = catalogue.features.flatMap((feature) =>
  feature.items
    .filter((item) => item.input.task.generationInput)
    .map((item) => ({ feature, item })),
);
const itemFor = (id: string): FeatureItem => {
  const item = cases.find(({ item }) => item.id === id)?.item;
  if (!item) throw new Error("Missing native fixture");
  return item;
};
const mentorTeacher = itemFor("mentor-config-improve-grounded-v1").input.task.generationInput;
const judge = itemFor("judge-config-improve-grounded-v1").input.task.generationInput;
if (
  mentorTeacher?.kind !== "mentor-generator" ||
  mentorTeacher.input.mode !== "improve" ||
  judge?.kind !== "judge-generator" ||
  judge.input.mode !== "improve"
)
  throw new Error("Invalid fixtures");
const { type: _type, ...teacherOutput } = mentorTeacher.input.currentConfiguration;
const roleplay = judge.input.lessonContext.aiMentorConfiguration;
if (!roleplay || roleplay.type !== "roleplay") throw new Error("Missing native roleplay");
const { type: _roleplayType, ...roleplayOutput } = roleplay;
const judgeOutput = judge.input.currentConfiguration;

const nativeService = (item: FeatureItem, raw: object) => {
  const prepared = prepareFeaturePrompt(item);
  const runtimeRequests: FeatureModelRequest[] = [];
  const runtime = (request: FeatureModelRequest) => {
    runtimeRequests.push(request);
    return Promise.resolve(raw);
  };
  const promptService = {
    loadPrompt: jest.fn(async (id: string) => {
      const index = item.input.task.promptFragments?.findIndex(
        (fragment) => fragment.promptId === id,
      );
      if (index === undefined || index < 0) throw new Error("Unexpected native prompt");
      // Read the identical authoritative fragment through a single-fragment task.
      const fragment = item.input.task.promptFragments?.[index];
      if (!fragment) throw new Error("Missing prompt fragment");
      const single = structuredClone(item);
      delete single.input.task.generationInput;
      single.input.task.promptFragments = [fragment];
      single.input.task.messages = [];
      return prepareFeaturePrompt(single).request.messages[0].content;
    }),
    isNotEmpty: jest.fn().mockResolvedValue(undefined),
  } as unknown as PromptService;
  const aiRuntime = {
    generateMentorConfiguration: runtime,
    generateJudgeConfiguration: runtime,
    validateMentorConfiguration: runtime,
    validateJudgeConfiguration: runtime,
  } as unknown as AiRuntimeService;
  const input = item.input.task.generationInput;
  if (!input) throw new Error("Missing generation input");
  const execute = () => {
    switch (input.kind) {
      case "mentor-generator":
        return new AiMentorConfigurationGeneratorService(promptService, aiRuntime).generate(
          input.input,
        );
      case "judge-generator":
        return new AiJudgeConfigurationGeneratorService(promptService, aiRuntime).generate(
          input.input,
        );
      case "mentor-validator":
        return new AiMentorConfigurationValidatorService(promptService, aiRuntime).validate(
          input.input,
        );
      case "judge-validator":
        return new AiJudgeConfigurationValidatorService(promptService, aiRuntime).validate(
          input.input,
        );
    }
  };
  return { execute, prepared, runtimeRequests };
};

describe("native configuration experiment composition", () => {
  it("covers every configuration case and all three native daily practice cases", () => {
    expect(cases).toHaveLength(23);
    for (const { item } of cases) expect(item.input.task.messages).toBeUndefined();
    for (const { item } of cases.filter(({ feature }) => feature.featureId === "daily-practice")) {
      const input = item.input.task.generationInput;
      expect(input?.kind).toBe("mentor-generator");
      if (input?.kind !== "mentor-generator") throw new Error("Wrong practice kind");
      expect(input.input.configurationType).toBe("roleplay");
      expect(input.input.generationPurpose).toBe("standalone_practice");
      expect(input.input.lessonContext.taskDescription).toBe(input.input.brief);
    }
  });

  it.each(cases)("matches the actual service request for $item.id", async ({ feature, item }) => {
    const input = item.input.task.generationInput;
    if (!input) throw new Error("Missing input");
    let raw: object = { summary: "Valid.", issues: [] };
    if (input.kind === "mentor-generator")
      raw = input.input.configurationType === "teacher" ? teacherOutput : roleplayOutput;
    if (input.kind === "judge-generator")
      raw = {
        ...judgeOutput,
        criteria: [...judgeOutput.criteria, { ...judgeOutput.criteria[0], ref: "C2" }],
      };
    const { execute, prepared, runtimeRequests } = nativeService(item, raw);
    const native = await execute();
    expect(runtimeRequests[0].messages).toEqual(prepared.request.messages);
    const harness = await runFeatureTask(feature, item, {
      run: true,
      allowModelRequests: true,
      model: async () => structuredClone(raw),
    });
    expect(harness.checks.productionOutputSchema).toBe(true);
    if (input.kind === "mentor-generator" || input.kind === "judge-generator") {
      expect(harness.output).toEqual(native);
      expect(harness.configurationEvidence?.rawGeneratedConfiguration).toEqual(raw);
      expect(harness.configurationEvidence?.scope).toContain("without_http_db_or_workflow");
      if (input.kind === "judge-generator" && input.input.mode === "repair") {
        expect((harness.output as typeof judgeOutput).criteria).toHaveLength(1);
        expect(
          (harness.configurationEvidence?.rawGeneratedConfiguration as typeof judgeOutput).criteria,
        ).toHaveLength(2);
      }
    }
  });
  it("still rejects a model-supplied type before native attachment", async () => {
    const selected = cases.find(({ item }) => item.id === "mentor-config-create-grounded-v1");
    if (!selected) throw new Error("Missing Teacher case");
    const raw = { ...teacherOutput, type: "teacher" };
    const result = await runFeatureTask(selected.feature, selected.item, {
      run: true,
      allowModelRequests: true,
      model: async () => raw,
    });
    expect(result.status).toBe("failed");
    expect(result.checks.productionOutputSchema).toBe(false);
    expect(result.configurationEvidence).toBeUndefined();
    await expect(nativeService(selected.item, raw).execute()).rejects.toThrow(
      "invalid configuration structure",
    );
  });
});
