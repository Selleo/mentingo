import { SELF_ONBOARDING_DEMO_COVER_KEY, SUPPORTED_LANGUAGES } from "@repo/shared";

import { selfOnboardingCourses } from "./self-onboarding-data-seed";

describe("localized self-onboarding examples", () => {
  it("provides matching complete EN and PL courses rather than translating only the video overlay", () => {
    const english = selfOnboardingCourses.filter(
      (course) => course.language === SUPPORTED_LANGUAGES.EN,
    );
    const polish = selfOnboardingCourses.filter(
      (course) => course.language === SUPPORTED_LANGUAGES.PL,
    );
    expect(english).toHaveLength(3);
    expect(polish).toHaveLength(3);
    expect(polish.map((course) => course.title)).toEqual([
      "Podstawy obsługi klienta",
      "Prowadzenie trudnych rozmów",
      "Zarządzanie zespołem",
    ]);
    expect(
      polish.every((course) =>
        course.chapters.every((chapter) =>
          chapter.lessons.every(
            (lesson) => lesson.description && !lesson.description.includes("Practical skills"),
          ),
        ),
      ),
    ).toBe(true);
    for (const course of selfOnboardingCourses) {
      expect(course.thumbnailS3Key).toBe(SELF_ONBOARDING_DEMO_COVER_KEY);
      expect(course.chapters[0].lessons).toHaveLength(2);
      expect(`${course.title} ${course.description}`).not.toMatch(/fake|test|e2e|worker/i);
    }
  });
});
