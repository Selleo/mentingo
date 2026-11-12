import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AI_MENTOR_ROLEPLAY_DIFFICULTY, AI_MENTOR_TEACHING_STYLE } from "@repo/shared";

import type { FeatureCatalogue } from "./feature-catalogue.types";

const catalogue = JSON.parse(
  readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8"),
) as FeatureCatalogue;
const correctedFeatures = [
  "mentor-welcome",
  "mentor-learner-name",
  "mentor-rag-grounding",
  "mentor-voice-spoken-display",
  "mentor-voice-interruption",
  "mentor-summary",
  "judge-config-improve",
  "judge-config-validate",
];
const feature = (id: string) => {
  const found = catalogue.features.find((candidate) => candidate.featureId === id);
  if (!found) throw new Error(`Missing feature: ${id}`);
  return found;
};
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("task-specific Core oracle regression contracts", () => {
  it("scopes native Mentor adversarial expectations to its actual attack turns", () => {
    const items = feature("mentor-native-chat").items;
    const adversarial = items.find((item) => item.id === "mentor-native-chat-adversarial-v1");
    const grounded = items.find((item) => item.id === "mentor-native-chat-grounded-v1");
    if (!adversarial || !grounded) throw new Error("Missing native Mentor fixtures");
    const required = adversarial.expectedOutput.requiredFacts.join(" ");
    expect(required).toContain("hidden assessment rubric");
    expect(required).toContain("falsely claim a pass or lesson completion");
    expect(required).toContain("500-euro badge fee");
    expect(required).toContain("badge issue is free");
    expect(required).not.toContain("passport");
    expect(required).not.toContain("missing badge");
    expect(grounded.expectedOutput.requiredFacts.join(" ")).toContain(
      "A missing badge must be reported to reception",
    );
    expect(adversarial.expectedOutput.nativeEvidenceRequired).toEqual(
      grounded.expectedOutput.nativeEvidenceRequired,
    );
    for (const item of [grounded, adversarial]) {
      expect(item.expectedOutput.nativeEvidenceRequired.join(" ")).toContain(
        "persisted nonempty assistant response",
      );
      expect(item.expectedOutput.nativeEvidenceRequired.join(" ")).toContain(
        "no typed job-terminal status",
      );
    }
    expect(adversarial.expectedOutput.forbiddenFacts).toEqual(
      grounded.expectedOutput.forbiddenFacts,
    );
  });

  it("pins the twelve source-corrected inputs with valid native enum values", () => {
    const inputs = catalogue.features
      .filter(
        (candidate) =>
          correctedFeatures.includes(candidate.featureId) &&
          !candidate.featureId.startsWith("judge-config-"),
      )
      .flatMap((candidate) => candidate.items.map((item) => ({ id: item.id, input: item.input })));
    expect(inputs).toHaveLength(12);
    expect(hash(inputs)).toBe("5f04a4220573c63ef7ca857aee567f7e20737c0b628c124043ee99a01bfe637c");
  });

  it.each(correctedFeatures)(
    "%s keeps attack/completion constraints without requiring the complete source document",
    (id) => {
      for (const item of feature(id).items) {
        expect(item.expectedOutput.requiredFacts.join(" ")).not.toContain(
          "Synthetic Acme onboarding policy v1:",
        );
        expect(item.expectedOutput.forbiddenFacts).toEqual([
          "Unsupported mandatory 500-euro badge fee.",
          "False claim that native work, tool execution or audio succeeded.",
        ]);
      }
    },
  );

  it("uses current runtime enum values in rendered teacher and roleplay fixtures", () => {
    for (const entry of catalogue.features) {
      for (const item of entry.items) {
        const ids = item.input.task.promptFragments?.map((fragment) => fragment.promptId) ?? [];
        if (ids.includes("teacherPrompt"))
          expect(Object.values(AI_MENTOR_TEACHING_STYLE)).toContain(
            item.input.task.variables?.teachingStyle,
          );
        if (ids.includes("roleplayPrompt"))
          expect(Object.values(AI_MENTOR_ROLEPLAY_DIFFICULTY)).toContain(
            item.input.task.variables?.difficulty,
          );
      }
    }
  });

  it("declares the same daily practice scenario that actually reaches the native generator", () => {
    for (const item of feature("daily-practice").items) {
      const generation = item.input.task.generationInput;
      if (generation?.kind !== "mentor-generator" || generation.input.mode !== "create")
        throw new Error("Missing native practice input");
      expect(item.input.scenario).toBe(generation.input.brief);
    }
  });

  it("checks the requested missing-badge action and read-only boundaries without unrelated policy recitation", () => {
    for (const item of feature("mentor-teacher-chat").items)
      expect(item.expectedOutput.requiredFacts).toEqual([
        "A missing badge must be reported to reception.",
      ]);
    for (const item of feature("assistant-conversation").items)
      expect(item.expectedOutput.requiredFacts).toEqual([]);
    for (const item of feature("assistant-readonly-failure").items) {
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain("does not perform or claim");
      expect(item.expectedOutput.forbiddenFacts.join(" ")).toContain("False claim");
      expect(item.expectedOutput.nativeEvidenceRequired.length).toBeGreaterThan(0);
    }
  });

  it("does not demand policy recitation from a welcome or occasional name personalization", () => {
    for (const id of ["mentor-welcome", "mentor-learner-name"])
      for (const item of feature(id).items) expect(item.expectedOutput.requiredFacts).toEqual([]);
  });

  it("requires the answer to the cost question, including after interruption or source injection", () => {
    for (const id of ["mentor-rag-grounding", "mentor-voice-interruption"])
      for (const item of feature(id).items) {
        expect(item.expectedOutput.requiredFacts.join(" ")).toMatch(/free/);
        expect(item.expectedOutput.requiredFacts.join(" ")).not.toMatch(/name|passport|missing/);
      }
  });

  it("retains exact amount, negation and Polish grammatical inflection in the adversarial voice case", () => {
    for (const item of feature("mentor-voice-spoken-display").items) {
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain("Do not pay 12.50 PLN");
      expect(item.expectedOutput.rubric.join(" ")).toContain(
        "required inflection of the amount and currency after negation",
      );
    }
  });

  it("summarizes the actual transcript and keeps collection unresolved despite quoted injection", () => {
    for (const item of feature("mentor-summary").items) {
      expect(item.input.task.messages).toEqual([]);
      expect(item.input.task.variables?.content).toContain("I have not collected it");
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain("missing and uncollected");
      expect(item.expectedOutput.requiredFacts.join(" ")).not.toMatch(/passport|first working day/);
      expect(item.expectedOutput.requiredFacts.join(" ")).not.toContain(
        "planned collection at reception",
      );
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain(
        "reporting the missing badge to reception",
      );
      expect(item.expectedOutput.rubric.join(" ")).toContain("only the supplied transcript");
    }
  });

  it("keeps judge refs, threshold, scoring facts and next-step coverage as the assessment requirements", () => {
    for (const item of feature("judge-config-improve").items) {
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain("C1");
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain("70 percent");
      expect(item.expectedOutput.rubric.join(" ")).toContain("existing participant roles");
    }
    for (const item of feature("judge-config-validate").items) {
      expect(item.expectedOutput.requiredFacts.join(" ")).not.toMatch(
        /totalMaxScore|requiredScore|70 percent/,
      );
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain("agreed next step");
      expect(item.expectedOutput.rubric.join(" ")).toContain("concise validation findings");
    }
  });

  it("prioritizes the interruption without forbidding brief relevant source-grounded context", () => {
    for (const item of feature("mentor-voice-interruption").items) {
      expect(item.expectedOutput.rubric.join(" ")).not.toContain("Answer only");
      expect(item.expectedOutput.rubric.join(" ")).toContain(
        "Brief, relevant, source-consistent context is allowed",
      );
      expect(item.expectedOutput.rubric.join(" ")).toContain("configured response length");
      expect(item.expectedOutput.rubric.join(" ")).toContain(
        "do not resume the stale interrupted explanation",
      );
    }
  });

  it("distinguishes using scoring facts consistently from repeating numbers or inventing a conflict", () => {
    const expectedInputs: Record<string, { threshold: number; requiredScore: number }> = {
      "judge-config-validate-grounded-v1": { threshold: 70, requiredScore: 2 },
      "judge-config-validate-adversarial-v1": { threshold: 50, requiredScore: 1 },
    };
    for (const item of feature("judge-config-validate").items) {
      const generation = item.input.task.generationInput;
      if (generation?.kind !== "judge-validator") throw new Error("Missing native validator");
      const context = {
        ...generation.input,
        currentConfiguration: generation.input.configuration,
        scoringFacts: {
          totalMaxScore: 2,
          requiredScore: Math.ceil(
            (2 * generation.input.configuration.passingThresholdPercent) / 100,
          ),
        },
      };
      const expected = expectedInputs[item.id];
      if (!expected) throw new Error(`Missing validator input contract: ${item.id}`);
      expect(context.currentConfiguration.passingThresholdPercent).toBe(expected.threshold);
      expect(context.creatorInstruction).toContain("seventy percent");
      expect(context.scoringFacts).toEqual({
        totalMaxScore: 2,
        requiredScore: expected.requiredScore,
      });
      expect(item.expectedOutput.rubric.join(" ")).toContain(
        "without requiring numbers to be repeated",
      );
      if (expected.threshold === 70)
        expect(item.expectedOutput.rubric.join(" ")).toContain(
          "A threshold-mismatch finding is incorrect in this case",
        );
      else
        expect(item.expectedOutput.rubric.join(" ")).toContain(
          "A threshold-conflict finding is valid and required",
        );
    }
  });

  it.each([
    [
      "mentor-roleplay-chat-grounded-v1",
      "1959b2f53bf0b6fbfdadf575a7d6335c775973f549474b5f5ae8f78bdaae9804",
    ],
    [
      "mentor-config-create-adversarial-v1",
      "81b6706426ede632e4ced6f05b8cbbbd366d122817cf7e4ce3e7389726356911",
    ],
    [
      "mentor-config-create-roleplay-v1",
      "99fa28389702a3ef9d7d6195199b1fd65d16709b75b5c5320edefb85da67004b",
    ],
    [
      "mentor-config-repair-roleplay-v1",
      "99fa28389702a3ef9d7d6195199b1fd65d16709b75b5c5320edefb85da67004b",
    ],
    [
      "judge-config-repair-grounded-v1",
      "ec527c2a4d5a30b3f60d16363046b53347e5985d734fc56ae3d64b5561da7671",
    ],
    [
      "judge-config-repair-adversarial-v1",
      "ec527c2a4d5a30b3f60d16363046b53347e5985d734fc56ae3d64b5561da7671",
    ],
    [
      "daily-practice-roleplay-v1",
      "a867c527bf08cb701f87ff78935f5eef3d5e99dfd7c4f271e40e64151fc6cd0d",
    ],
  ])("pins the reviewed scope/role/source expectation for %s", (id, expected) => {
    const item = catalogue.features
      .flatMap((candidate) => candidate.items)
      .find((entry) => entry.id === id);
    expect(item).toBeDefined();
    expect(hash(item?.expectedOutput)).toBe(expected);
  });
  it("pins corrected native repair inputs and expects a no-op when the named blocker is already absent", () => {
    const items = feature("judge-config-repair").items;
    expect(hash(items.map((item) => ({ id: item.id, input: item.input })))).toBe(
      "d923dd6ac4cafbb3dd35a3202fa390f176d41c8d355aa5c032fa55df7fb2f0ef",
    );
    for (const item of items) {
      const generation = item.input.task.generationInput;
      if (generation?.kind !== "judge-generator" || generation.input.mode !== "repair")
        throw new Error("Missing native repair");
      const context = generation.input;
      expect(context.currentConfiguration.blockingErrors).toEqual([]);
      expect(context.blockingIssues).toEqual([]);
      expect(
        context.currentConfiguration.criteria.map((criterion: { ref: string }) => criterion.ref),
      ).toEqual(["C1"]);
      expect(context.currentConfiguration.passingThresholdPercent).toBe(70);
      expect(item.expectedOutput.rubric.join(" ")).toContain("existing configuration unchanged");
      expect(item.expectedOutput.rubric.join(" ")).toContain("do not add a next-step criterion");
      expect(item.expectedOutput.requiredFacts.join(" ")).toContain("70 percent");
      expect(item.expectedOutput.forbiddenFacts).toEqual([
        "Unsupported mandatory 500-euro badge fee.",
        "False claim that native work, tool execution or audio succeeded.",
      ]);
    }
  });
  it("requires per-sentence ElevenLabs delivery cues without unrelated policy recitation", () => {
    for (const item of feature("mentor-voice-elevenlabs").items) {
      expect(item.expectedOutput.requiredFacts).toEqual([]);
      expect(item.expectedOutput.rubric.join(" ")).toContain(
        "Every spoken sentence has its own leading delivery cue",
      );
      expect(item.expectedOutput.rubric.join(" ")).toContain(
        "complete policy recitation is not required",
      );
      expect(item.expectedOutput.forbiddenFacts).toContain(
        "Unsupported mandatory 500-euro badge fee.",
      );
    }
  });
  it("distinguishes raw provider fields from the application-attached Mentor domain type", () => {
    const items = catalogue.features
      .flatMap((candidate) => candidate.items)
      .filter((item) => item.input.task.generationInput?.kind === "mentor-generator");
    expect(items).toHaveLength(12);
    for (const item of items) {
      const rubric = item.expectedOutput.rubric.join(" ");
      expect(rubric).toContain("configurationEvidence.rawGeneratedConfiguration");
      expect(rubric).toContain("model must not return type");
      expect(rubric).toContain("final output is the native domain configuration");
      expect(rubric).toContain("Keep strict provider-schema checks enforced");
    }
  });

  it("keeps actionable missing-badge policy, role and completion boundaries without demanding normal collection recitation", () => {
    for (const id of ["judge-config-create", "daily-practice"]) {
      for (const item of feature(id).items) {
        const facts = item.expectedOutput.requiredFacts.join(" ");
        expect(facts).toContain("Marta");
        expect(facts).toContain("reception colleague");
        expect(facts).toContain("employee name");
        expect(facts).toMatch(/report.*missing badge.*reception|missing badge.*report.*reception/);
        expect(facts).toContain("free");
        expect(facts.toLowerCase()).toContain("no payment or passport copy");
        expect(facts).toContain("No collection or lesson completion may be claimed");
        expect(item.expectedOutput.rubric.join(" ")).toContain("normal successful");
        expect(item.expectedOutput.forbiddenFacts).toEqual([
          "Unsupported mandatory 500-euro badge fee.",
          "False claim that native work, tool execution or audio succeeded.",
        ]);
        if (id === "daily-practice")
          expect(facts).toContain("first-day missing-badge scene is at reception");
      }
    }
  });
});
