export const ACCESS_GUARD = {
  UNREGISTERED_COURSE_ACCESS: "unregisteredCourseAccess",
  UNREGISTERED_QA_ACCESS: "unregisteredQAAccess",
  UNREGISTERED_NEWS_ACCESS: "unregisteredNewsAccess",
  UNREGISTERED_ARTICLES_ACCESS: "unregisteredArticlesAccess",
} as const;

export type AccessGuard = (typeof ACCESS_GUARD)[keyof typeof ACCESS_GUARD];
