import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LessonType, type Chapter, type Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

import "i18n";
import { useContentLessonForm } from "./useContentLessonForm";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  setDirty: vi.fn(),
}));
vi.mock("~/api/mutations/admin/useBetaCreateContentLesson", () => ({
  useCreateBetaContentLesson: () => ({ mutateAsync: mocks.create }),
}));
vi.mock("~/api/mutations/admin/useUpdateContentLesson", () => ({
  useUpdateContentLesson: () => ({ mutateAsync: mocks.update }),
}));
vi.mock("~/api/mutations/admin/useDeleteLesson", () => ({
  useDeleteLesson: () => ({ mutateAsync: mocks.remove }),
}));
vi.mock("~/context/LeaveModalContext", () => ({
  useLeaveModal: () => ({ isLeavingContent: false, setIsCurrectFormDirty: mocks.setDirty }),
}));

const description =
  '<p>Interview</p><audio data-node-type="audio" src="/api/lesson/lesson-resource/11111111-1111-4111-8111-111111111111" data-name="Interview.mp3" controls="" preload="metadata"></audio>';
const lesson = {
  id: "lesson-id",
  type: LessonType.CONTENT,
  title: "Interview",
  description,
} as Lesson;
const chapter = { id: "chapter-id" } as Chapter;

describe("content lesson audio persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves serialized audio in the explicitly selected translation without changing its resource URL", async () => {
    const { result } = renderHook(() =>
      useContentLessonForm({
        chapterToEdit: chapter,
        lessonToEdit: lesson,
        language: "lt",
        setContentTypeToDisplay: vi.fn(),
      }),
    );
    await act(async () => result.current.onSubmit(result.current.form.getValues()));
    expect(mocks.update).toHaveBeenCalledWith({
      lessonId: lesson.id,
      data: { title: "Interview", type: LessonType.CONTENT, description, language: "lt" },
    });
  });

  it("preserves draft context when creating audio content using the existing chapter-base-language contract", async () => {
    const { result } = renderHook(() =>
      useContentLessonForm({
        chapterToEdit: chapter,
        lessonToEdit: null,
        language: "en",
        contextId: "draft-context",
        setContentTypeToDisplay: vi.fn(),
      }),
    );
    await act(async () =>
      result.current.onSubmit({ title: "Interview", type: LessonType.CONTENT, description }),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        title: "Interview",
        type: LessonType.CONTENT,
        description,
        chapterId: chapter.id,
        contextId: "draft-context",
      },
    });
  });
});
