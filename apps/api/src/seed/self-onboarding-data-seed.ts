import { SELF_ONBOARDING_DEMO_COVER_KEY, SUPPORTED_LANGUAGES } from "@repo/shared";

import { LESSON_TYPES } from "src/lesson/lesson.type";

import type { NiceCourseData } from "src/utils/types/test-types";

const topics = [
  { en: "Customer support fundamentals", pl: "Podstawy obsługi klienta" },
  { en: "Handling difficult conversations", pl: "Prowadzenie trudnych rozmów" },
  { en: "Team leadership", pl: "Zarządzanie zespołem" },
];

/** Complete, local media-backed examples; no fake test courses, random thumbnails or untranslated lesson text. */
export const selfOnboardingCourses: NiceCourseData[] = topics.flatMap((topic) =>
  [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL].map((language) => {
    const polish = language === SUPPORTED_LANGUAGES.PL;
    return {
      title: topic[language],
      description: polish
        ? "Praktyczne umiejętności przydatne w codziennej pracy zespołu."
        : "Practical skills for everyday teamwork.",
      category: polish ? "Rozwój zawodowy" : "Professional development",
      language,
      thumbnailS3Key: SELF_ONBOARDING_DEMO_COVER_KEY,
      status: "published" as const,
      hasCertificate: true,
      priceInCents: 0,
      chapters: [
        {
          title: polish ? "Od wiedzy do praktyki" : "From knowledge to practice",
          isFreemium: false,
          lessons: [
            {
              type: LESSON_TYPES.CONTENT,
              title: polish ? "Przygotowanie do rozmowy" : "Preparing for the conversation",
              description: polish
                ? "Ustal cel rozmowy, poznaj potrzeby drugiej osoby i zaproponuj konkretny następny krok."
                : "Set the goal, understand the other person's needs and agree on a concrete next step.",
            },
            {
              type: LESSON_TYPES.CONTENT,
              title: polish ? "Zastosuj umiejętności w pracy" : "Apply your skills at work",
              description: polish
                ? "Przećwicz poznane kroki na przykładzie ze swojego zespołu. Sprawdź rezultat i zaplanuj dalsze działania."
                : "Practice the steps using an example from your team. Check the outcome and plan what to do next.",
            },
          ],
        },
      ],
    };
  }),
);
