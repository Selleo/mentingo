import { AI_MENTOR_TTS_PRESET, AI_MENTOR_VOICE_MODE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { aiMentorLessonFormSchema } from "./useAiMentorLessonFormSchema";

import type { TFunction } from "i18next";

const t = ((key: string) => key) as TFunction;

describe("aiMentorLessonFormSchema", () => {
  it("reports both missing configurations for a new lesson", () => {
    const result = aiMentorLessonFormSchema(t, true).safeParse({
      title: "Practice lesson",
      description: "",
      name: "Mentor",
      voiceMode: AI_MENTOR_VOICE_MODE.PRESET,
      ttsPreset: AI_MENTOR_TTS_PRESET.MALE,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const paths = result.error.issues.map(({ path }) => path.join("."));
    expect(paths).toContain("aiMentorConfiguration");
    expect(paths).toContain("aiJudgeConfiguration");
  });
});
