import { act, fireEvent, screen } from "@testing-library/react";
import { useFormContext } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "~/api/queryClient";
import { renderWith } from "~/utils/testUtils";

import { LEARNING_HANDLES } from "../../../../e2e/data/learning/handles";

import { Quiz } from "./Quiz";

import type { GetLessonByIdResponse } from "~/api/generated-api";

const mocks = vi.hoisted(() => ({
  submitQuiz: vi.fn(),
  startQuizAttempt: vi.fn(),
  saveQuizAttemptDraft: vi.fn(),
  isPreviewMode: false,
}));

vi.mock("@remix-run/react", () => ({ useParams: () => ({ courseId: "course-1" }) }));
vi.mock("~/api/mutations", () => ({
  useSubmitQuiz: () => ({ mutate: mocks.submitQuiz, isPending: false }),
  useRetakeQuiz: () => ({ mutate: vi.fn() }),
  useQuizRetakeStatus: () => ({ hoursLeft: null, canRetake: false }),
  useStartQuizAttempt: () => ({ mutate: mocks.startQuizAttempt, isPending: false }),
  useSaveQuizAttemptDraft: () => ({ mutate: mocks.saveQuizAttemptDraft }),
}));
vi.mock("~/api/queries", () => ({
  courseQueryOptions: () => ({ queryKey: ["course"] }),
  lessonQueryOptions: () => ({ queryKey: ["lesson"] }),
}));
vi.mock("~/api/queries/useCertificates", () => ({
  certificatesQueryOptions: () => ({ queryKey: ["certificates"] }),
}));
vi.mock("~/api/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    getQueryState: vi.fn(() => undefined),
  },
}));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({ isPreviewMode: mocks.isPreviewMode }),
}));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => ({ language: "en" }),
}));
vi.mock("./Questions", () => ({
  Questions: () => {
    const { register } = useFormContext();

    return (
      <input data-testid="answer" {...register("singleAnswerQuestions.question-1.option-1")} />
    );
  },
}));

const NOW = new Date("2026-01-01T10:00:00.000Z");
const SELECTED_ANSWER = [{ questionId: "question-1", answers: [{ answerId: "option-1" }] }];

type QuizAttempt = NonNullable<GetLessonByIdResponse["data"]["quizAttempt"]>;

const buildAttempt = (overrides: Partial<QuizAttempt> = {}): QuizAttempt => ({
  attemptId: "attempt-1",
  startedAt: NOW.toISOString(),
  expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
  serverNow: NOW.toISOString(),
  submitGraceSeconds: 30,
  draftAnswers: [],
  draftSavedAt: null,
  ...overrides,
});

const buildLesson = (overrides: Partial<GetLessonByIdResponse["data"]> = {}) =>
  ({
    id: "lesson-1",
    type: "quiz",
    learningStateId: null,
    lessonCompleted: false,
    thresholdScore: 50,
    attempts: 0,
    attemptsLimit: null,
    quizCooldownInHours: null,
    updatedAt: null,
    isQuizFeedbackRedacted: false,
    timeLimitMinutes: 5,
    quizAttempt: null,
    quizDetails: {
      questions: [{ id: "question-1", type: "single_choice", options: [{ id: "option-1" }] }],
    },
    ...overrides,
  }) as unknown as GetLessonByIdResponse["data"];

const renderQuiz = (lesson: GetLessonByIdResponse["data"]) => {
  const view = renderWith({ withQuery: true }).render(<Quiz lesson={lesson} userId="student-1" />);

  return {
    ...view,
    rerenderQuiz: (nextLesson: GetLessonByIdResponse["data"]) =>
      view.rerender(<Quiz lesson={nextLesson} userId="student-1" />),
  };
};

const answer = () =>
  fireEvent.change(screen.getByTestId("answer"), { target: { value: "option-1" } });
const submitButton = () => screen.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON);
const clickSubmit = async () => {
  await act(async () => {
    fireEvent.click(submitButton());
  });
};

describe("timed quiz", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mocks.isPreviewMode = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the learner to start before showing the questions", () => {
    renderQuiz(buildLesson());

    expect(screen.queryByTestId("answer")).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON));

    expect(mocks.startQuizAttempt).toHaveBeenCalledWith({
      lessonId: "lesson-1",
      language: "en",
      learningStateId: null,
    });
  });

  it("submits the restored answers automatically when time runs out", () => {
    renderQuiz(
      buildLesson({
        quizAttempt: buildAttempt({
          expiresAt: new Date(NOW.getTime() + 2_000).toISOString(),
          draftAnswers: SELECTED_ANSWER,
          draftSavedAt: NOW.toISOString(),
        }),
      }),
    );

    expect(screen.getByTestId("answer")).toHaveValue("option-1");
    expect(screen.getByTestId(LEARNING_HANDLES.QUIZ_TIMER)).toBeInTheDocument();
    expect(mocks.submitQuiz).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2_500));

    expect(mocks.submitQuiz).toHaveBeenCalledTimes(1);
    expect(mocks.submitQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: "lesson-1", questionsAnswers: SELECTED_ANSWER }),
      expect.anything(),
    );
    // restoring the draft is not an edit, so nothing is autosaved
    expect(mocks.saveQuizAttemptDraft).not.toHaveBeenCalled();
  });

  it("autosaves the answers after the learner stops editing", () => {
    renderQuiz(buildLesson({ quizAttempt: buildAttempt() }));

    answer();
    act(() => vi.advanceTimersByTime(999));
    expect(mocks.saveQuizAttemptDraft).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.saveQuizAttemptDraft).toHaveBeenCalledWith({
      lessonId: "lesson-1",
      attemptId: "attempt-1",
      questionsAnswers: SELECTED_ANSWER,
      learningStateId: null,
    });
  });

  it("drops a pending autosave when the learner submits", async () => {
    renderQuiz(buildLesson({ quizAttempt: buildAttempt() }));

    answer();
    await clickSubmit();
    act(() => vi.advanceTimersByTime(2_000));

    expect(mocks.submitQuiz).toHaveBeenCalledTimes(1);
    expect(mocks.saveQuizAttemptDraft).not.toHaveBeenCalled();
  });

  it("saves pending answers when the learner leaves the quiz", () => {
    const { unmount } = renderQuiz(buildLesson({ quizAttempt: buildAttempt() }));

    answer();
    unmount();

    expect(mocks.saveQuizAttemptDraft).toHaveBeenCalledTimes(1);
  });

  it("fills the form with the draft of a newly started attempt", () => {
    const { rerenderQuiz } = renderQuiz(buildLesson());

    rerenderQuiz(
      buildLesson({
        quizAttempt: buildAttempt({ attemptId: "attempt-2", draftAnswers: SELECTED_ANSWER }),
      }),
    );

    expect(screen.getByTestId("answer")).toHaveValue("option-1");
  });

  it("restores a newer draft of a cached attempt unless the learner already edited", () => {
    const { rerenderQuiz } = renderQuiz(buildLesson({ quizAttempt: buildAttempt() }));

    expect(screen.getByTestId("answer")).toHaveValue("");

    rerenderQuiz(
      buildLesson({
        quizAttempt: buildAttempt({
          draftAnswers: SELECTED_ANSWER,
          draftSavedAt: new Date(NOW.getTime() + 1_000).toISOString(),
        }),
      }),
    );
    expect(screen.getByTestId("answer")).toHaveValue("option-1");

    fireEvent.change(screen.getByTestId("answer"), { target: { value: "" } });
    rerenderQuiz(
      buildLesson({
        quizAttempt: buildAttempt({
          draftAnswers: SELECTED_ANSWER,
          draftSavedAt: new Date(NOW.getTime() + 2_000).toISOString(),
        }),
      }),
    );
    expect(screen.getByTestId("answer")).toHaveValue("");
  });

  it("does not submit twice when time runs out during a manual submit", async () => {
    renderQuiz(
      buildLesson({
        quizAttempt: buildAttempt({ expiresAt: new Date(NOW.getTime() + 2_000).toISOString() }),
      }),
    );

    await clickSubmit();
    act(() => vi.advanceTimersByTime(3_000));

    expect(mocks.submitQuiz).toHaveBeenCalledTimes(1);
  });

  it("lets the learner retry a failed automatic submit until the grace period ends", async () => {
    mocks.submitQuiz.mockImplementation(
      (_body, options: { onError: (error: Error) => void; onSettled: () => void }) => {
        options.onError(new Error("network"));
        options.onSettled();
      },
    );
    renderQuiz(
      buildLesson({
        quizAttempt: buildAttempt({ expiresAt: new Date(NOW.getTime() + 1_000).toISOString() }),
      }),
    );

    act(() => vi.advanceTimersByTime(1_500));
    expect(mocks.submitQuiz).toHaveBeenCalledTimes(1);
    // the answers stay on the server for the server-side finalization
    expect(mocks.saveQuizAttemptDraft).toHaveBeenCalledTimes(1);
    expect(submitButton()).toBeEnabled();

    await clickSubmit();
    expect(mocks.submitQuiz).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(30_000));
    expect(submitButton()).toBeDisabled();
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
  });

  it("shows a completed timed quiz without the start step or timer", () => {
    renderQuiz(buildLesson({ lessonCompleted: true, quizAttempt: buildAttempt() }));

    expect(screen.getByTestId("answer")).toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.QUIZ_TIMER)).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("previews a timed quiz without the start step or timer", () => {
    mocks.isPreviewMode = true;
    renderQuiz(buildLesson());

    expect(screen.getByTestId("answer")).toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.QUIZ_TIMER)).not.toBeInTheDocument();
  });

  it("keeps untimed quizzes free of the start step and timer", () => {
    renderQuiz(buildLesson({ timeLimitMinutes: null }));

    expect(screen.getByTestId("answer")).toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.QUIZ_TIMER)).not.toBeInTheDocument();
  });
});
