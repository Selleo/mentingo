import type i18next from "i18next";

export const studentDashboardSteps = (t: typeof i18next.t) => [
  {
    selector: "#client-statistics",
    content: t("studentOnboarding.dashboard.clientStatistics"),
  },
  {
    selector: "#profile",
    content: t("studentOnboarding.dashboard.profile"),
  },
  {
    selector: "#course-stats",
    content: t("studentOnboarding.dashboard.courseStats"),
  },
  {
    selector: "#quiz-stats",
    content: t("studentOnboarding.dashboard.quizStats"),
  },
  {
    selector: "#continue-learning",
    content: t("studentOnboarding.dashboard.continueLearning"),
  },
];

export const studentCoursesSteps = (t: typeof i18next.t) => [
  {
    selector: "#your-list",
    content: t("studentOnboarding.courses.yourList"),
  },
  {
    selector: "#course-filters",
    content: t("studentOnboarding.courses.availableListFilters"),
  },
  {
    selector: "#available-courses",
    content: t("studentOnboarding.courses.availableCourses"),
  },
];

export const studentAnnouncementsSteps = (t: typeof i18next.t) => [
  {
    selector: "#announcements",
    content: t("studentOnboarding.announcements.stayInformed"),
  },
];

export const studentSettingsSteps = (t: typeof i18next.t) => [
  {
    selector: "#settings-tabs",
    content: t("studentOnboarding.settings.welcome"),
  },
  {
    selector: "#change-language",
    content: t("studentOnboarding.settings.language"),
  },
  {
    selector: "#change-email",
    content: t("studentOnboarding.settings.email"),
  },
  {
    selector: "#change-password",
    content: t("studentOnboarding.settings.password"),
  },
];

export const studentProfileSteps = (t: typeof i18next.t) => [
  {
    selector: "#profile-card",
    content: t("studentOnboarding.profile.info"),
  },
  {
    selector: "#certificates",
    content: t("studentOnboarding.profile.certificates"),
  },
];

export const studentProviderInformationSteps = (t: typeof i18next.t) => [
  {
    selector: "#provider-information",
    content: t("studentOnboarding.providerInformation.welcome"),
  },
];
