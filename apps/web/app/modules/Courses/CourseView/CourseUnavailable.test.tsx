import { render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import pl from "~/locales/pl/translation.json";

import CourseUnavailable from "./CourseUnavailable";
import { COURSE_UNAVAILABLE_REASONS } from "./CourseView.constants";

const path = "/course/introduction?language=pl#overview";

async function renderUnavailable(
  reason: "requiresAuthentication" | "notFound",
  canAccessCourseList = false,
) {
  const i18n = createInstance();
  await i18n.init({ lng: "pl", resources: { pl: { translation: pl } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <CourseUnavailable reason={reason} canAccessCourseList={canAccessCourseList} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe("CourseUnavailable", () => {
  it("invites anonymous users to sign in with their exact course destination", async () => {
    const { container } = await renderUnavailable(
      COURSE_UNAVAILABLE_REASONS.REQUIRES_AUTHENTICATION,
    );
    expect(
      screen.getByRole("heading", { name: "Zaloguj się, aby przejść do kursu" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Przejdź do logowania" })).toHaveAttribute(
      "href",
      `/auth/login?returnTo=${encodeURIComponent(path)}`,
    );
    expect(container.querySelector(".lucide-log-in")).toBeInTheDocument();
  });

  it.each([true, false])(
    "keeps not-found navigation unchanged (course list: %s)",
    async (canAccessCourseList) => {
      await renderUnavailable(COURSE_UNAVAILABLE_REASONS.NOT_FOUND, canAccessCourseList);
      expect(screen.getByRole("heading", { name: "Nie znaleziono kursu" })).toBeVisible();
      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        canAccessCourseList ? "/courses" : "/dashboard",
      );
    },
  );
});
