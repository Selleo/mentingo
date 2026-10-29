export const COURSE_VIEWERS = {
  ADMIN: "admin",
  COURSE_AUTHOR: "course author",
  OTHER_CONTENT_CREATOR: "other content creator",
  ENROLLED_STUDENT: "enrolled student",
  STUDENT: "student",
  MANAGING_GROUP_MANAGER: "group manager of an assigned group",
  GROUP_MANAGER: "group manager without the course",
  TRAINER: "trainer",
  ANONYMOUS: "anonymous visitor",
} as const;

export const COURSE_STATES = {
  PUBLISHED: "published",
  DRAFT: "draft",
  PRIVATE: "private",
  ARCHIVED: "archived",
} as const;

export const COURSE_DETAIL_OUTCOMES = {
  VISIBLE: "sees the course",
  MANAGER_PREVIEW: "sees the course as a manager preview",
  FORBIDDEN: "is forbidden",
  NOT_FOUND: "gets not found",
} as const;

export const COURSE_LOOKUP_OUTCOMES = {
  FOUND: "finds the course",
  NOT_FOUND: "gets not found",
} as const;

export const BETA_COURSE_OUTCOMES = {
  VISIBLE: "sees the authoring view",
  FORBIDDEN: "is forbidden",
  UNAUTHORIZED: "is unauthorized",
} as const;

export const MANAGER_SCOPES = {
  GROUP_COURSE_ASSIGNMENT: "manages a group the course is assigned to",
  MEMBER_ENROLLMENT: "manages a group whose member is enrolled",
  UNRELATED_GROUP: "manages an unrelated group",
  ENROLLED_LEARNER_MANAGER: "manages an assigned group and is enrolled as a learner",
  CATALOG_LEARNER_MANAGER: "manages an unrelated group and can read the catalog",
} as const;

export const TITLE_TRANSLATIONS = {
  REQUESTED_LANGUAGE_ONLY: "requested language only",
  BASE_LANGUAGE_FALLBACK: "base language fallback",
} as const;

export const LESSON_FILE_URLS = {
  SIGNED: "signed",
  NOT_SIGNED: "not signed",
} as const;

export const VIDEO_EMBED_RESULTS = {
  MARKED_AS_ERROR: "marked as an error",
  UNCHANGED: "left unchanged",
  ERROR_CLEARED: "error cleared",
} as const;

export type CourseViewer = (typeof COURSE_VIEWERS)[keyof typeof COURSE_VIEWERS];
export type CourseState = (typeof COURSE_STATES)[keyof typeof COURSE_STATES];
export type CourseDetailOutcome =
  (typeof COURSE_DETAIL_OUTCOMES)[keyof typeof COURSE_DETAIL_OUTCOMES];
export type CourseLookupOutcome =
  (typeof COURSE_LOOKUP_OUTCOMES)[keyof typeof COURSE_LOOKUP_OUTCOMES];
export type BetaCourseOutcome = (typeof BETA_COURSE_OUTCOMES)[keyof typeof BETA_COURSE_OUTCOMES];
export type ManagerScope = (typeof MANAGER_SCOPES)[keyof typeof MANAGER_SCOPES];
export type TitleTranslation = (typeof TITLE_TRANSLATIONS)[keyof typeof TITLE_TRANSLATIONS];
export type LessonFileUrl = (typeof LESSON_FILE_URLS)[keyof typeof LESSON_FILE_URLS];
export type VideoEmbedResult = (typeof VIDEO_EMBED_RESULTS)[keyof typeof VIDEO_EMBED_RESULTS];

export const COURSE_DETAIL_ACCESS_CASES: Array<{
  viewer: CourseViewer;
  courseState: CourseState;
  outcome: CourseDetailOutcome;
}> = [
  {
    viewer: COURSE_VIEWERS.ADMIN,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.ADMIN,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.ADMIN,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.ADMIN,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.COURSE_AUTHOR,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.COURSE_AUTHOR,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.COURSE_AUTHOR,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.COURSE_AUTHOR,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.OTHER_CONTENT_CREATOR,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.OTHER_CONTENT_CREATOR,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.OTHER_CONTENT_CREATOR,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.OTHER_CONTENT_CREATOR,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.ENROLLED_STUDENT,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.ENROLLED_STUDENT,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.ENROLLED_STUDENT,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.ENROLLED_STUDENT,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.STUDENT,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.STUDENT,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.STUDENT,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.STUDENT,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.MANAGING_GROUP_MANAGER,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.MANAGER_PREVIEW,
  },
  {
    viewer: COURSE_VIEWERS.MANAGING_GROUP_MANAGER,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.MANAGING_GROUP_MANAGER,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.MANAGING_GROUP_MANAGER,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.GROUP_MANAGER,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.GROUP_MANAGER,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.GROUP_MANAGER,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.GROUP_MANAGER,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.TRAINER,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.TRAINER,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.TRAINER,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.TRAINER,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.ANONYMOUS,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    viewer: COURSE_VIEWERS.ANONYMOUS,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.ANONYMOUS,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
  {
    viewer: COURSE_VIEWERS.ANONYMOUS,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_DETAIL_OUTCOMES.FORBIDDEN,
  },
];

export const MANAGER_PREVIEW_CASES: Array<{
  scope: ManagerScope;
  outcome: CourseDetailOutcome;
}> = [
  {
    scope: MANAGER_SCOPES.GROUP_COURSE_ASSIGNMENT,
    outcome: COURSE_DETAIL_OUTCOMES.MANAGER_PREVIEW,
  },
  {
    scope: MANAGER_SCOPES.MEMBER_ENROLLMENT,
    outcome: COURSE_DETAIL_OUTCOMES.MANAGER_PREVIEW,
  },
  {
    scope: MANAGER_SCOPES.UNRELATED_GROUP,
    outcome: COURSE_DETAIL_OUTCOMES.NOT_FOUND,
  },
  {
    scope: MANAGER_SCOPES.ENROLLED_LEARNER_MANAGER,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
  {
    scope: MANAGER_SCOPES.CATALOG_LEARNER_MANAGER,
    outcome: COURSE_DETAIL_OUTCOMES.VISIBLE,
  },
];

export const COURSE_TITLE_LANGUAGE_CASES: Array<{
  viewer: CourseViewer;
  titleTranslation: TitleTranslation;
}> = [
  { viewer: COURSE_VIEWERS.ADMIN, titleTranslation: TITLE_TRANSLATIONS.REQUESTED_LANGUAGE_ONLY },
  {
    viewer: COURSE_VIEWERS.COURSE_AUTHOR,
    titleTranslation: TITLE_TRANSLATIONS.REQUESTED_LANGUAGE_ONLY,
  },
  {
    viewer: COURSE_VIEWERS.OTHER_CONTENT_CREATOR,
    titleTranslation: TITLE_TRANSLATIONS.BASE_LANGUAGE_FALLBACK,
  },
  { viewer: COURSE_VIEWERS.STUDENT, titleTranslation: TITLE_TRANSLATIONS.BASE_LANGUAGE_FALLBACK },
];

export const COURSE_LOOKUP_CASES: Array<{
  viewer: CourseViewer;
  courseState: CourseState;
  outcome: CourseLookupOutcome;
}> = [
  {
    viewer: COURSE_VIEWERS.ANONYMOUS,
    courseState: COURSE_STATES.PUBLISHED,
    outcome: COURSE_LOOKUP_OUTCOMES.FOUND,
  },
  {
    viewer: COURSE_VIEWERS.ANONYMOUS,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_LOOKUP_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.ANONYMOUS,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_LOOKUP_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.STUDENT,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_LOOKUP_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.STUDENT,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_LOOKUP_OUTCOMES.NOT_FOUND,
  },
  {
    viewer: COURSE_VIEWERS.ENROLLED_STUDENT,
    courseState: COURSE_STATES.PRIVATE,
    outcome: COURSE_LOOKUP_OUTCOMES.FOUND,
  },
  {
    viewer: COURSE_VIEWERS.COURSE_AUTHOR,
    courseState: COURSE_STATES.DRAFT,
    outcome: COURSE_LOOKUP_OUTCOMES.FOUND,
  },
  {
    viewer: COURSE_VIEWERS.ADMIN,
    courseState: COURSE_STATES.ARCHIVED,
    outcome: COURSE_LOOKUP_OUTCOMES.FOUND,
  },
];

export const BETA_COURSE_ACCESS_CASES: Array<{
  viewer: CourseViewer;
  outcome: BetaCourseOutcome;
}> = [
  { viewer: COURSE_VIEWERS.ADMIN, outcome: BETA_COURSE_OUTCOMES.VISIBLE },
  { viewer: COURSE_VIEWERS.COURSE_AUTHOR, outcome: BETA_COURSE_OUTCOMES.VISIBLE },
  { viewer: COURSE_VIEWERS.OTHER_CONTENT_CREATOR, outcome: BETA_COURSE_OUTCOMES.FORBIDDEN },
  { viewer: COURSE_VIEWERS.STUDENT, outcome: BETA_COURSE_OUTCOMES.FORBIDDEN },
  { viewer: COURSE_VIEWERS.GROUP_MANAGER, outcome: BETA_COURSE_OUTCOMES.FORBIDDEN },
  { viewer: COURSE_VIEWERS.ANONYMOUS, outcome: BETA_COURSE_OUTCOMES.UNAUTHORIZED },
];

export const SIGNED_STORAGE_URL_PREFIX = "https://storage.test/signed/";
export const BUNNY_PLAYBACK_URL_PREFIX = "https://video.test/play/";

export const LESSON_FILE_CASES: Array<{
  source: string;
  fileS3Key: string;
  bunnyConfigured: boolean;
  fileUrl: LessonFileUrl;
}> = [
  {
    source: "a storage key",
    fileS3Key: "lesson/handout.pdf",
    bunnyConfigured: false,
    fileUrl: LESSON_FILE_URLS.SIGNED,
  },
  {
    source: "a remote url",
    fileS3Key: "https://cdn.test/handout.pdf",
    bunnyConfigured: false,
    fileUrl: LESSON_FILE_URLS.NOT_SIGNED,
  },
  {
    source: "a video provider key while the provider is unavailable",
    fileS3Key: "bunny-lesson-video",
    bunnyConfigured: false,
    fileUrl: LESSON_FILE_URLS.NOT_SIGNED,
  },
  {
    source: "a video provider key while the provider is available",
    fileS3Key: "bunny-lesson-video",
    bunnyConfigured: true,
    fileUrl: LESSON_FILE_URLS.SIGNED,
  },
];

export const VIDEO_EMBED_CASES: Array<{
  embed: string;
  resourceReference: string;
  bunnyConfigured: boolean;
  embedHasError: boolean;
  result: VideoEmbedResult;
}> = [
  {
    embed: "provider video while the provider is unavailable",
    resourceReference: "bunny-embedded-video",
    bunnyConfigured: false,
    embedHasError: false,
    result: VIDEO_EMBED_RESULTS.MARKED_AS_ERROR,
  },
  {
    embed: "storage video while the provider is unavailable",
    resourceReference: "lesson/embedded-video.mp4",
    bunnyConfigured: false,
    embedHasError: false,
    result: VIDEO_EMBED_RESULTS.UNCHANGED,
  },
  {
    embed: "previously failed video once the provider is available",
    resourceReference: "bunny-embedded-video",
    bunnyConfigured: true,
    embedHasError: true,
    result: VIDEO_EMBED_RESULTS.ERROR_CLEARED,
  },
];
