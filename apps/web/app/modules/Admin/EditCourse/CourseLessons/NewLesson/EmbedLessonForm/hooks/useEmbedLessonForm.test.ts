import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEmbedLessonForm } from "./useEmbedLessonForm";

import type { Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

vi.mock("@remix-run/react", () => ({ useParams: () => ({ id: "course" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/api/mutations/admin/useCreateEmbedLesson", () => ({
  useCreateEmbedLesson: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/admin/useUpdateEmbedLesson", () => ({
  useUpdateEmbedLesson: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/admin/useDeleteLesson", () => ({
  useDeleteLesson: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/queries/admin/useBetaCourse", () => ({ courseQueryOptions: vi.fn() }));
vi.mock("~/api/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock("~/context/LeaveModalContext", () => ({
  useLeaveModal: () => ({ setIsCurrectFormDirty: vi.fn() }),
}));

const first: Lesson = {
  id: "first",
  title: "First embed",
  description: "",
  type: "embed",
  displayOrder: 0,
  updatedAt: "2026-01-01",
  lessonResources: [
    { id: "resource-1", fileUrl: "https://example.com/first", allowFullscreen: false },
  ],
};
const second: Lesson = {
  ...first,
  id: "second",
  title: "Second embed",
  lessonResources: [
    { id: "resource-2", fileUrl: "https://example.com/second", allowFullscreen: true },
    { id: "resource-3", fileUrl: "https://example.com/extra", allowFullscreen: false },
  ],
};

const renderForm = (lessonToEdit: Lesson | null) =>
  renderHook(
    ({ lessonToEdit }: { lessonToEdit: Lesson | null }) =>
      useEmbedLessonForm({
        chapterToEdit: null,
        lessonToEdit,
        setContentTypeToDisplay: vi.fn(),
        language: "en",
      }),
    { initialProps: { lessonToEdit } },
  );

const valuesFor = (lesson: Lesson) => ({
  title: lesson.title,
  type: "embed",
  resources: lesson.lessonResources,
});

describe("useEmbedLessonForm selection", () => {
  it("clears the previous lesson when opening a new embed form", () => {
    const { result, rerender } = renderForm(first);
    rerender({ lessonToEdit: null });
    expect(result.current.form.getValues()).toEqual({ title: "", type: "embed", resources: [] });
  });
  it("replaces discarded edits with clean defaults for the next lesson", () => {
    const { result, rerender } = renderForm(first);
    expect(result.current.form.formState.isDirty).toBe(false);
    act(() => result.current.form.setValue("title", "Discarded draft", { shouldDirty: true }));
    expect(result.current.form.formState.isDirty).toBe(true);
    rerender({ lessonToEdit: second });
    expect(result.current.form.getValues()).toEqual(valuesFor(second));
    expect(result.current.form.formState.isDirty).toBe(false);
    act(() => result.current.form.setValue("title", "Another draft", { shouldDirty: true }));
    act(() => result.current.form.reset());
    expect(result.current.form.getValues()).toEqual(valuesFor(second));
  });

  it("removes stale resources for a lesson without resources", () => {
    const { result, rerender } = renderForm(second);
    rerender({ lessonToEdit: { ...first, lessonResources: undefined } });
    expect(result.current.form.getValues()).toEqual({
      title: first.title,
      type: "embed",
      resources: [],
    });
  });

  it("loads the selected embed title and every resource when switching both ways", () => {
    const { result, rerender } = renderForm(first);
    expect(result.current.form.getValues()).toEqual(valuesFor(first));
    rerender({ lessonToEdit: second });
    expect(result.current.form.getValues()).toEqual(valuesFor(second));
    expect(result.current.form.formState.isDirty).toBe(false);
    rerender({ lessonToEdit: first });
    expect(result.current.form.getValues()).toEqual(valuesFor(first));
  });
});
