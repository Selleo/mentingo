import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TTS_PRESET,
  AI_MENTOR_TYPE,
  AI_MENTOR_VOICE_MODE,
} from "@repo/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LessonType, type Chapter, type Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

const mocks = vi.hoisted(() => ({
  createAiMentorLesson: vi.fn(),
  deleteAiMentorLesson: vi.fn(),
  updateAiMentorLesson: vi.fn(),
  uploadAvatar: vi.fn(),
  invalidateQueries: vi.fn(),
  setIsCurrectFormDirty: vi.fn(),
}));

vi.mock("@remix-run/react", () => ({
  useParams: () => ({ id: "course-id" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key.includes("instructions.scenarioSimulation")) return "Act as a business client.";
      if (key.includes("conditions.scenarioSimulation")) {
        return "<ul><li>Asks about the budget.</li><li>Asks about the timeline.</li></ul>";
      }
      if (key.includes("blockingErrors.scenarioSimulation")) {
        return "Makes a commitment that contradicts the client's constraints.";
      }
      if (key.includes("scoreGuidance.notMetDescription")) {
        return "No observable evidence of the expected behavior.";
      }
      if (key.includes("scoreGuidance.notMetExample")) {
        return "The response omits the expected behavior.";
      }
      if (key.includes("scoreGuidance.metDescription")) {
        return "Clearly demonstrates the expected behavior in context.";
      }
      if (key.includes("acceptedExamples.scenarioSimulation.0")) {
        return "What budget range have you allocated?";
      }
      if (key.includes("acceptedExamples.scenarioSimulation.1")) {
        return "Is the three-month deadline fixed?";
      }
      return key;
    },
  }),
}));

vi.mock("~/api/mutations/admin/useCreateAiMentorLesson", () => ({
  useCreateAiMentorLesson: () => ({ mutateAsync: mocks.createAiMentorLesson }),
}));

vi.mock("~/api/mutations/admin/useDeleteLesson", () => ({
  useDeleteLesson: () => ({ mutateAsync: mocks.deleteAiMentorLesson }),
}));

vi.mock("~/api/mutations/admin/useUpdateAiMentorLesson", () => ({
  useUpdateAiMentorLesson: () => ({ mutateAsync: mocks.updateAiMentorLesson }),
}));

vi.mock("~/api/mutations/admin/useUploadAiMentorAvatar", () => ({
  useUploadAiMentorAvatar: () => ({ mutateAsync: mocks.uploadAvatar }),
}));

vi.mock("~/api/queryClient", () => ({
  queryClient: { invalidateQueries: mocks.invalidateQueries },
}));

vi.mock("~/context/LeaveModalContext", () => ({
  useLeaveModal: () => ({
    isLeavingContent: false,
    setIsCurrectFormDirty: mocks.setIsCurrectFormDirty,
  }),
}));

import { useAiMentorLessonForm } from "./useAiMentorLessonForm";

describe("useAiMentorLessonForm", () => {
  const lessonToEdit: Lesson = {
    id: "lesson-id",
    updatedAt: "2026-07-13T00:00:00.000Z",
    type: LessonType.AI_MENTOR,
    displayOrder: 1,
    title: "Discovery call",
    description: "Practice discovery",
    aiMentor: {
      id: "ai-mentor-id",
      lessonId: "lesson-id",
      name: "Customer",
      voiceMode: AI_MENTOR_VOICE_MODE.PRESET,
      ttsPreset: AI_MENTOR_TTS_PRESET.MALE,
    },
  };
  const chapterToEdit: Chapter = {
    id: "chapter-id",
    title: "Sales",
    updatedAt: "2026-07-13T00:00:00.000Z",
    displayOrder: 1,
    isFree: false,
    lessonCount: 1,
    lessons: [lessonToEdit],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateAiMentorLesson.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it("creates a lesson with staged Mentor and Judge configurations", async () => {
    mocks.createAiMentorLesson.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAiMentorLessonForm({
        chapterToEdit,
        lessonToEdit: null,
        setContentTypeToDisplay: vi.fn(),
        language: "en",
        baseLanguage: "en",
      }),
    );

    act(() => {
      result.current.form.setValue("aiMentorConfiguration", {
        type: AI_MENTOR_TYPE.ROLEPLAY,
        scenario: "Discovery call",
        aiRole: "Customer",
        learnerRole: "Sales representative",
        characterGoal: "Assess whether the offer is relevant",
        difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
      });
      result.current.form.setValue("aiJudgeConfiguration", {
        taskGoal: "Complete the discovery call",
        passingThresholdPercent: 0,
        criteria: [],
        blockingErrors: [],
      });
    });

    const values = result.current.form.getValues();

    await act(async () => {
      await result.current.onSubmit(values);
    });

    expect(mocks.createAiMentorLesson).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chapterId: "chapter-id",
        aiMentorConfiguration: expect.objectContaining(values.aiMentorConfiguration ?? {}),
        aiJudgeConfiguration: expect.objectContaining(values.aiJudgeConfiguration ?? {}),
      }),
    });
  });

  it("normalizes empty optional Mentor fields before creating a lesson", async () => {
    mocks.createAiMentorLesson.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAiMentorLessonForm({
        chapterToEdit,
        lessonToEdit: null,
        setContentTypeToDisplay: vi.fn(),
        language: "en",
        baseLanguage: "en",
      }),
    );
    const configuration = {
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "Discovery call",
      aiRole: "Customer",
      learnerRole: "Sales representative",
      characterGoal: "Assess whether the offer is relevant",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
      factsAndConstraints: "",
      openingInstruction: "",
      additionalInstructions: "",
    } as const;

    act(() => {
      result.current.form.setValue("aiMentorConfiguration", configuration);
      result.current.form.setValue("aiJudgeConfiguration", {
        taskGoal: "Complete the discovery call",
        passingThresholdPercent: 0,
        criteria: [],
        blockingErrors: [],
      });
    });

    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues());
    });

    expect(mocks.createAiMentorLesson).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aiMentorConfiguration: expect.objectContaining({
          factsAndConstraints: null,
          openingInstruction: null,
          additionalInstructions: null,
        }),
      }),
    });
  });

  it("does not resave an unchanged Judge configuration with the lesson form", async () => {
    const saveStagedAiJudgeConfiguration = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAiMentorLessonForm({
        chapterToEdit,
        lessonToEdit,
        setContentTypeToDisplay: vi.fn(),
        language: "en",
        baseLanguage: "en",
        onSaveStagedAiJudgeConfiguration: saveStagedAiJudgeConfiguration,
      }),
    );
    const configuration = {
      taskGoal: "Complete the discovery call",
      passingThresholdPercent: 0,
      criteria: [],
      blockingErrors: [],
    };

    act(() => {
      result.current.form.setValue("aiJudgeConfiguration", configuration, {
        shouldDirty: false,
      });
    });

    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues());
    });

    expect(mocks.updateAiMentorLesson).toHaveBeenCalledOnce();
    expect(saveStagedAiJudgeConfiguration).not.toHaveBeenCalled();
  });

  it("does not restore an earlier staged draft after the edited assessment was saved", async () => {
    const saveStagedAiJudgeConfiguration = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAiMentorLessonForm({
        chapterToEdit,
        lessonToEdit,
        setContentTypeToDisplay: vi.fn(),
        language: "en",
        baseLanguage: "en",
        onSaveStagedAiJudgeConfiguration: saveStagedAiJudgeConfiguration,
      }),
    );
    const generatedConfiguration = {
      taskGoal: "Complete the discovery call",
      passingThresholdPercent: 60,
      criteria: [],
      blockingErrors: [],
    };
    const editedConfiguration = {
      ...generatedConfiguration,
      taskGoal: "Discover the customer's priorities and agree a next step",
    };

    act(() => {
      result.current.form.setValue("aiJudgeConfiguration", generatedConfiguration, {
        shouldDirty: true,
      });
      result.current.form.resetField("aiJudgeConfiguration", {
        defaultValue: editedConfiguration,
      });
    });

    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues());
    });

    expect(result.current.form.getValues("aiJudgeConfiguration")).toEqual(editedConfiguration);
    expect(saveStagedAiJudgeConfiguration).not.toHaveBeenCalled();
  });
});
