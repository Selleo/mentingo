import { render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pl from "~/locales/pl/translation.json";

import LessonPage from "./Lesson.page";

let user: { id: string } | undefined;
const { fetchQuery } = vi.hoisted(() => ({
  fetchQuery: vi.fn(() => Promise.reject(new Error("Unauthorized"))),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: user }),
  useLesson: () => ({ data: undefined, isFetching: false, isError: true }),
  useCourse: () => ({ data: undefined }),
  lessonQueryOptions: () => ({ queryKey: ["lesson"] }),
}));
vi.mock("~/api/queries/useCourse", () => ({
  courseQueryOptions: () => ({ queryKey: ["course"] }),
  getCourseQueryKey: () => ["course"],
}));
vi.mock("~/api/queryClient", () => ({ queryClient: { fetchQuery } }));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => ({ language: "pl", setLanguage: vi.fn() }),
}));
vi.mock("~/hooks/useLearningTimeTracker", () => ({ useLearningTimeTracker: vi.fn() }));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  CourseAccessProvider: () => null,
  useCourseAccessProvider: vi.fn(),
}));
vi.mock("~/modules/Courses/Lesson/LearningModeBanner", () => ({ LearningModeBanner: () => null }));
vi.mock("~/modules/Courses/Lesson/LessonContent", () => ({ LessonContent: () => null }));
vi.mock("~/modules/Courses/Lesson/LessonSidebar", () => ({ LessonSidebar: () => null }));

const path = "/course/course-1/lesson/lesson-1?language=pl&preview=true#section-2";
async function renderLesson() {
  const i18n = createInstance();
  await i18n.init({ lng: "pl", resources: { pl: { translation: pl } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/course/:courseId/lesson/:lessonId" element={<LessonPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe("LessonPage access errors", () => {
  beforeEach(() => {
    user = undefined;
  });

  it("invites anonymous visitors to login with the exact lesson destination", async () => {
    const { container } = await renderLesson();
    expect(
      await screen.findByRole("heading", { name: "Zaloguj się, aby przejść do lekcji" }),
    ).toBeVisible();
    expect(screen.getByText("Zaloguj się lub utwórz konto, aby przejść do lekcji.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Przejdź do logowania" })).toHaveAttribute(
      "href",
      `/auth/login?returnTo=${encodeURIComponent(path)}`,
    );
    expect(container.querySelector(".lucide-log-in")).toBeInTheDocument();
    expect(screen.queryByText("Brak uprawnień")).not.toBeInTheDocument();
  });

  it("keeps authenticated denial and the back-to-course action unchanged", async () => {
    user = { id: "student-1" };
    const { container } = await renderLesson();
    expect(await screen.findByRole("heading", { name: "Brak uprawnień" })).toBeVisible();
    expect(screen.getByText("Nie masz uprawnień do dostępu do tej lekcji.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Wróć do kursu" })).toHaveAttribute(
      "href",
      "/course/course-1",
    );
    expect(container.querySelector(".lucide-log-in")).not.toBeInTheDocument();
  });
});
