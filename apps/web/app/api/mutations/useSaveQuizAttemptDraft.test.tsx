import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { queryClient } from "~/api/queryClient";

import { useSaveQuizAttemptDraft } from "./useSaveQuizAttemptDraft";

import type { PropsWithChildren } from "react";
import type { GetLessonByIdResponse } from "~/api/generated-api";

const mocks = vi.hoisted(() => ({ saveDraft: vi.fn(), toast: vi.fn() }));

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { lessonControllerSaveQuizAttemptDraft: mocks.saveDraft } },
}));
vi.mock("~/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const LESSON_KEY = ["lesson", "lesson-1", "en", "student-1"];
const ANSWERS = [{ questionId: "question-1", answers: [{ answerId: "option-1" }] }];

describe("useSaveQuizAttemptDraft", () => {
  it("keeps the cached lesson draft current so returning to the quiz restores it", async () => {
    mocks.saveDraft.mockResolvedValue({ data: { data: { draftSavedAt: "2026-01-01T10:00:05Z" } } });
    queryClient.setQueryData<GetLessonByIdResponse>(
      LESSON_KEY,
      {
        data: {
          quizAttempt: {
            attemptId: "attempt-1",
            serverNow: "2026-01-01T10:00:00Z",
            draftAnswers: [],
            draftSavedAt: null,
          },
        },
      } as unknown as GetLessonByIdResponse,
      { updatedAt: 1_000 },
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSaveQuizAttemptDraft(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        lessonId: "lesson-1",
        attemptId: "attempt-1",
        questionsAnswers: ANSWERS,
      });
    });

    const cached = queryClient.getQueryData<GetLessonByIdResponse>(LESSON_KEY);

    expect(cached?.data.quizAttempt).toMatchObject({
      draftAnswers: ANSWERS,
      draftSavedAt: "2026-01-01T10:00:05Z",
    });
    // the countdown pairs serverNow with the original fetch time
    expect(queryClient.getQueryState(LESSON_KEY)?.dataUpdatedAt).toBe(1_000);
  });
});
