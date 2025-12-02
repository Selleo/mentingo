import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

import { ACTIVITY_LOG_ACTION_TYPES } from "src/activity-logs/types";
import { LESSON_SEQUENCE_ENABLED } from "src/courses/constants";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { archived, availableLocales, baseLanguage, id, timestamps } from "./utils";

import type { ActivityLogMetadata } from "src/activity-logs/types";
import type { ActivityHistory, AllSettings } from "src/common/types";
import type { CourseSettings } from "src/courses/types/settings";
import type { GroupCourseSettings } from "src/group/group.types";

export const users = pgTable("users", {
  ...id,
  ...timestamps,
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatarReference: varchar("avatar_reference", { length: 200 }),
  role: text("role").notNull().default(USER_ROLES.STUDENT),
  archived,
  deletedAt: timestamp("deleted_at", {
    mode: "string",
    withTimezone: true,
    precision: 3,
  }),
});

export const userDetails = pgTable("user_details", {
  ...id,
  ...timestamps,
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  contactPhoneNumber: text("contact_phone_number"),
  description: text("description"),
  contactEmail: text("contact_email"),
  jobTitle: text("job_title"),
});

export const userStatistics = pgTable("user_statistics", {
  ...id,
  ...timestamps,
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: timestamp("last_activity_date", { withTimezone: true }),

  activityHistory: jsonb("activity_history").$type<ActivityHistory>().default({}),
});

export const quizAttempts = pgTable("quiz_attempts", {
  ...id,
  ...timestamps,
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  lessonId: uuid("lesson_id")
    .references(() => lessons.id)
    .notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  wrongAnswers: integer("wrong_answers").notNull(),
  score: integer("score").notNull(),
});

export const credentials = pgTable("credentials", {
  ...id,
  ...timestamps,
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  password: text("password").notNull(),
});

export const categories = pgTable("categories", {
  ...id,
  ...timestamps,
  title: text("title").notNull().unique(),
  archived,
});

export const createTokens = pgTable("create_tokens", {
  ...id,
  ...timestamps,
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createToken: text("create_token").notNull(),
  expiryDate: timestamp("expiry_date", {
    precision: 3,
    withTimezone: true,
  }).notNull(),
  reminderCount: integer("reminder_count").notNull().default(0),
});

export const resetTokens = pgTable("reset_tokens", {
  ...id,
  ...timestamps,
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  resetToken: text("reset_token").notNull(),
  expiryDate: timestamp("expiry_date", {
    precision: 3,
    withTimezone: true,
  }).notNull(),
});

export const coursesStatusEnum = pgEnum("status", ["draft", "published", "private"]);

export const courses = pgTable("courses", {
  ...id,
  ...timestamps,
  title: jsonb("title").default({}).notNull(),
  description: jsonb("description").default({}).notNull(),
  thumbnailS3Key: varchar("thumbnail_s3_key", { length: 200 }),
  status: coursesStatusEnum("status").notNull().default("draft"),
  hasCertificate: boolean("has_certificate").notNull().default(false),
  priceInCents: integer("price_in_cents").notNull().default(0),
  currency: varchar("currency").notNull().default("usd"),
  chapterCount: integer("chapter_count").notNull().default(0),
  isScorm: boolean("is_scorm").notNull().default(false),
  authorId: uuid("author_id")
    .references(() => users.id)
    .notNull(),
  categoryId: uuid("category_id")
    .references(() => categories.id)
    .notNull(),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  settings: jsonb("settings")
    .$type<CourseSettings>()
    .notNull()
    .default({ lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED }),
  baseLanguage: text("base_language").notNull().default("en"),
  availableLocales: text("available_locales")
    .array()
    .notNull()
    .default(sql`ARRAY['en']::text[]`),
});

export const chapters = pgTable("chapters", {
  ...id,
  ...timestamps,
  title: jsonb("title").default({}).notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  authorId: uuid("author_id")
    .references(() => users.id)
    .notNull(),
  isFreemium: boolean("is_freemium").notNull().default(false),
  displayOrder: integer("display_order"),
  lessonCount: integer("lesson_count").notNull().default(0),
});

export const lessons = pgTable("lessons", {
  ...id,
  ...timestamps,
  chapterId: uuid("chapter_id")
    .references(() => chapters.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  title: jsonb("title").default({}).notNull(),
  description: jsonb("description"),
  thresholdScore: integer("threshold_score"),
  attemptsLimit: integer("attempts_limit"),
  quizCooldownInHours: integer("quiz_cooldown_in_hours"),
  displayOrder: integer("display_order"),
  fileS3Key: varchar("file_s3_key", { length: 200 }),
  fileType: varchar("file_type", { length: 20 }),
  isExternal: boolean("is_external").default(false),
});

export const aiMentorLessons = pgTable("ai_mentor_lessons", {
  ...id,
  ...timestamps,
  lessonId: uuid("lesson_id")
    .references(() => lessons.id, { onDelete: "cascade" })
    .notNull(),
  aiMentorInstructions: text("ai_mentor_instructions").notNull(),
  completionConditions: text("completion_conditions").notNull(),
  name: text("name").notNull().default("AI Mentor"),
  avatarReference: varchar("avatar_reference", { length: 200 }),
  type: text("type").notNull().default("mentor"),
});

export const aiMentorThreads = pgTable("ai_mentor_threads", {
  ...id,
  ...timestamps,
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  aiMentorLessonId: uuid("ai_mentor_lesson_id")
    .references(() => aiMentorLessons.id, { onDelete: "cascade" })
    .notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  userLanguage: varchar("user_language", { length: 20 }).notNull().default("en"),
});

export const aiMentorThreadMessages = pgTable("ai_mentor_thread_messages", {
  ...id,
  ...timestamps,
  threadId: uuid("thread_id")
    .notNull()
    .references(() => aiMentorThreads.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull().default(0),
  archived: boolean("archived").default(false),
});

export const questions = pgTable("questions", {
  ...id,
  ...timestamps,
  lessonId: uuid("lesson_id")
    .references(() => lessons.id, { onDelete: "cascade" })
    .notNull(),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  title: jsonb("title").default({}).notNull(),
  displayOrder: integer("display_order"),
  photoS3Key: varchar("photo_s3_key", { length: 200 }),
  description: jsonb("description"),
  solutionExplanation: jsonb("solution_explanation"),
});

export const questionAnswerOptions = pgTable("question_answer_options", {
  ...id,
  ...timestamps,
  questionId: uuid("question_id")
    .references(() => questions.id, { onDelete: "cascade" })
    .notNull(),
  optionText: jsonb("option_text").default({}).notNull(),
  isCorrect: boolean("is_correct").notNull(),
  displayOrder: integer("display_order"),
  matchedWord: jsonb("matched_word"),
  scaleAnswer: integer("scale_answer"),
});

export const studentQuestionAnswers = pgTable(
  "student_question_answers",
  {
    ...id,
    ...timestamps,
    questionId: uuid("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),
    studentId: uuid("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    answer: jsonb("answer").default({}),
    isCorrect: boolean("is_correct"),
  },
  (table) => ({
    unq: unique().on(table.questionId, table.studentId),
  }),
);

export const studentCourses = pgTable(
  "student_courses",
  {
    ...id,
    ...timestamps,
    studentId: uuid("student_id")
      .references(() => users.id)
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id)
      .notNull(),
    progress: varchar("progress").notNull().default("not_started"),
    finishedChapterCount: integer("finished_chapter_count").default(0).notNull(),
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
      precision: 3,
    }),
    courseCompletionMetadata: jsonb("course_completion_metadata"),
    enrolledAt: timestamp("enrolled_at", {
      mode: "string",
      withTimezone: true,
      precision: 3,
    }).defaultNow(),
    status: varchar("status").notNull().default("enrolled"), // enrolled/not_enrolled
    paymentId: varchar("payment_id", { length: 50 }),
    enrolledByGroupId: uuid("enrolled_by_group_id").references(() => groups.id),
  },
  (table) => ({
    unq: unique().on(table.studentId, table.courseId),
  }),
);

export const studentLessonProgress = pgTable(
  "student_lesson_progress",
  {
    ...id,
    ...timestamps,
    studentId: uuid("student_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    chapterId: uuid("chapter_id")
      .references(() => chapters.id, { onDelete: "cascade" })
      .notNull(),
    lessonId: uuid("lesson_id")
      .references(() => lessons.id, { onDelete: "cascade" })
      .notNull(),
    completedQuestionCount: integer("completed_question_count").default(0).notNull(),
    quizScore: integer("quiz_score"),
    attempts: integer("attempts"),
    isQuizPassed: boolean("is_quiz_passed"),
    isStarted: boolean("is_started").default(false),
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
      precision: 3,
    }),
    languageAnswered: text("language_answered").default(SUPPORTED_LANGUAGES.EN),
  },
  (table) => ({
    unq: unique().on(table.studentId, table.lessonId, table.chapterId),
  }),
);

export const aiMentorStudentLessonProgress = pgTable("ai_mentor_student_lesson_progress", {
  ...id,
  ...timestamps,
  studentLessonProgressId: uuid("student_lesson_progress_id")
    .references(() => studentLessonProgress.id, { onDelete: "cascade" })
    .notNull(),
  summary: text("summary"),
  score: integer("score"),
  minScore: integer("min_score"),
  maxScore: integer("max_score"),
  percentage: integer("percentage"),
  passed: boolean("passed").default(false),
});

export const studentChapterProgress = pgTable(
  "student_chapter_progress",
  {
    ...id,
    ...timestamps,
    studentId: uuid("student_id")
      .references(() => users.id)
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id)
      .notNull(),
    chapterId: uuid("chapter_id")
      .references(() => chapters.id)
      .notNull(),
    completedLessonCount: integer("completed_lesson_count").default(0).notNull(),
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
      precision: 3,
    }),
    completedAsFreemium: boolean("completed_as_freemium").notNull().default(false),
  },
  (table) => ({
    unq: unique().on(table.studentId, table.courseId, table.chapterId),
  }),
);

export const coursesSummaryStats = pgTable("courses_summary_stats", {
  ...id,
  ...timestamps,
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  freePurchasedCount: integer("free_purchased_count").notNull().default(0),
  paidPurchasedCount: integer("paid_purchased_count").notNull().default(0),
  paidPurchasedAfterFreemiumCount: integer("paid_purchased_after_freemium_count")
    .notNull()
    .default(0),
  completedFreemiumStudentCount: integer("completed_freemium_student_count").notNull().default(0),
  completedCourseStudentCount: integer("completed_course_student_count").notNull().default(0),
});

export const courseStudentsStats = pgTable(
  "course_students_stats",
  {
    ...id,
    ...timestamps,
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    newStudentsCount: integer("new_students_count").notNull().default(0),
  },
  (table) => ({
    unq: unique().on(table.courseId, table.month, table.year),
  }),
);

export const lessonLearningTime = pgTable(
  "lesson_learning_time",
  {
    ...id,
    ...timestamps,
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lessonId: uuid("lesson_id")
      .references(() => lessons.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    totalSeconds: integer("total_seconds").notNull().default(0),
  },
  (table) => ({
    unq: unique().on(table.userId, table.lessonId),
    userCourseIdx: index("lesson_learning_time_user_course_idx").on(table.userId, table.courseId),
  }),
);

export const scormMetadata = pgTable("scorm_metadata", {
  ...id,
  ...timestamps,
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  fileId: uuid("file_id")
    .references(() => scormFiles.id)
    .notNull(),
  version: text("version").notNull(),
  entryPoint: text("entry_point").notNull(),
  s3Key: text("s3_key").notNull(),
});

export const scormFiles = pgTable("scorm_files", {
  ...id,
  ...timestamps,
  title: text("title").notNull(),
  type: text("type").notNull(),
  s3KeyPath: text("s3_key_path").notNull(),
});

export const groups = pgTable("groups", {
  ...id,
  ...timestamps,
  name: text("name").notNull(),
  characteristic: text("characteristic"),
});

export const groupUsers = pgTable(
  "group_users",
  {
    ...id,
    ...timestamps,
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => ({
    unq: unique().on(table.userId, table.groupId),
  }),
);

export const groupCourses = pgTable(
  "group_courses",
  {
    ...id,
    ...timestamps,
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    enrolledBy: uuid("enrolled_by").references(() => users.id),
    settings: jsonb("settings")
      .$type<GroupCourseSettings>()
      .notNull()
      .default({ isMandatory: false }),
  },
  (table) => ({
    unq: unique().on(table.groupId, table.courseId),
  }),
);

export const settings = pgTable("settings", {
  ...id,
  ...timestamps,
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  settings: jsonb("settings").$type<AllSettings>().notNull(),
});

export const certificates = pgTable(
  "certificates",
  {
    ...id,
    ...timestamps,
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => ({
    unq: unique().on(table.userId, table.courseId),
  }),
);

export const announcements = pgTable("announcements", {
  ...id,
  ...timestamps,
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  isEveryone: boolean("is_everyone").notNull().default(false),
});

export const userAnnouncements = pgTable(
  "user_announcements",
  {
    ...id,
    ...timestamps,
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    announcementId: uuid("announcement_id")
      .references(() => announcements.id, { onDelete: "cascade" })
      .notNull(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true, precision: 3 }),
  },
  (table) => ({
    unq: unique().on(table.userId, table.announcementId),
  }),
);

export const groupAnnouncements = pgTable(
  "group_announcements",
  {
    ...id,
    ...timestamps,
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    announcementId: uuid("announcement_id")
      .references(() => announcements.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => ({
    unq: unique().on(table.groupId, table.announcementId),
  }),
);

export const documents = pgTable("documents", {
  ...id,
  ...timestamps,
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  checksum: text("check_sum").notNull().unique(),
  status: text("status").notNull().default("processing"), // 'processing' | 'ready' | 'failed'
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
});

export const docChunks = pgTable(
  "doc_chunks",
  {
    ...id,
    ...timestamps,
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    metadata: jsonb("metadata"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (t) => ({
    uniqueOrder: { columns: [t.documentId, t.chunkIndex], unique: true },
  }),
);

export const documentToAiMentorLesson = pgTable(
  "document_to_ai_mentor_lesson",
  {
    ...id,
    ...timestamps,
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    aiMentorLessonId: uuid("ai_mentor_lesson_id")
      .references(() => aiMentorLessons.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    unq: unique().on(t.documentId, t.aiMentorLessonId),
  }),
);

export const secrets = pgTable(
  "secrets",
  {
    ...id,
    ...timestamps,
    secretName: text("secret_name").notNull(),
    version: integer("version").default(1).notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    encryptedDek: text("encrypted_dek").notNull(),
    encryptedDekIV: text("encrypted_dek_iv").notNull(),
    encryptedDekTag: text("encrypted_dek_tag").notNull(),
    alg: text("alg").notNull().default("AES-256-GCM"),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    nameUnique: uniqueIndex("secrets_name_uq").on(t.secretName),
    nameIdx: index("secrets_name_idx").on(t.secretName),
  }),
);

export const lessonResources = pgTable("lesson_resources", {
  ...id,
  ...timestamps,
  source: varchar("source", { length: 1000 }).notNull(),
  isExternal: boolean("is_external").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  allowFullscreen: boolean("allow_fullscreen").notNull().default(false),
  type: varchar("type", { length: 50 }).default("embed").notNull(),
  lessonId: uuid("lesson_id")
    .references(() => lessons.id, { onDelete: "cascade" })
    .notNull(),
});

export const userOnboarding = pgTable(
  "user_onboarding",
  {
    ...id,
    ...timestamps,
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    dashboard: boolean("dashboard").notNull().default(false),
    courses: boolean("courses").notNull().default(false),
    announcements: boolean("announcements").notNull().default(false),
    profile: boolean("profile").notNull().default(false),
    settings: boolean("settings").notNull().default(false),
    providerInformation: boolean("provider_information").notNull().default(false),
  },
  (table) => ({
    unq: unique().on(table.userId),
  }),
);

export const activityLogsActionTypeEnum = pgEnum(
  "activity_log_action_type",
  Object.values(ACTIVITY_LOG_ACTION_TYPES) as [string, ...string[]],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    ...id,
    ...timestamps,
    actorId: uuid("actor_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    actorEmail: text("actor_email").notNull(),
    actorRole: text("actor_role").notNull(),
    actionType: activityLogsActionTypeEnum("action_type").notNull(),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata").$type<ActivityLogMetadata>().notNull(),
  },
  (table) => ({
    actorIdx: index("activity_logs_actor_idx").on(table.actorId, table.createdAt),
    actionIdx: index("activity_logs_action_idx").on(table.actionType, table.createdAt),
    timeframeIdx: index("activity_logs_timeframe_idx").on(table.createdAt),
    resourceIdx: index("activity_logs_resource_idx").on(table.resourceType, table.resourceId),
  }),
);

export const questionsAndAnswers = pgTable("questions_and_answers", {
  ...id,
  ...timestamps,
  title: jsonb("title").default({}).notNull(),
  description: jsonb("description").default({}).notNull(),
  metadata: jsonb("metadata").default({}),
  baseLanguage: text("base_language").notNull().default("en"),
  availableLocales: text("available_locales")
    .array()
    .notNull()
    .default(sql`ARRAY['en']::text[]`),
});

export const resources = pgTable("resources", {
  ...id,
  ...timestamps,
  title: jsonb("title").notNull().default({}),
  description: jsonb("description").notNull().default({}),
  reference: varchar("reference", { length: 200 }).notNull(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  metadata: jsonb("metadata").default({}),
  uploadedBy: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  archived,
});

export const resourceEntity = pgTable(
  "resource_entity",
  {
    ...id,
    ...timestamps,
    resourceId: uuid("resource_id")
      .references(() => resources.id, { onDelete: "cascade" })
      .notNull(),
    entityId: uuid("entity_id").notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    relationshipType: varchar("relationship_type", { length: 100 }).notNull().default("attachment"), // attachment / cover_image
  },
  (table) => ({
    resourceIdx: index("resource_entity_resource_idx").on(table.resourceId),
    entityIdx: index("resource_entity_entity_idx").on(table.entityId, table.entityType),
    relationshipIdx: index("resource_entity_relationship_idx").on(
      table.entityId,
      table.entityType,
      table.relationshipType,
    ),
    unq: unique().on(table.resourceId, table.entityId, table.entityType, table.relationshipType),
  }),
);

export const articleStatusEnum = pgEnum("article_status", ["draft", "published"]);

export const articles = pgTable(
  "articles",
  {
    ...id,
    ...timestamps,
    title: jsonb("title").notNull().default({}),
    summary: jsonb("summary").notNull().default({}),
    content: jsonb("content").notNull().default({}),
    status: articleStatusEnum("status").notNull().default("draft"),
    isPublic: boolean("is_public").notNull().default(true),
    archived,
    baseLanguage,
    availableLocales,
    publishedAt: timestamp("published_at", {
      mode: "string",
      withTimezone: true,
      precision: 3,
    }),
    articleSectionId: uuid("article_section_id").references(() => articleSections.id, {
      onDelete: "cascade",
    }),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    updatedBy: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    articleSectionIdx: index("article_section_idx").on(table.articleSectionId),
  }),
);

export const articleSections = pgTable("article_sections", {
  ...id,
  ...timestamps,
  title: jsonb("title").notNull().default({}),
  baseLanguage,
  availableLocales,
});

export const newsStatusEnum = pgEnum("news_status", ["draft", "published"]);

export const news = pgTable("news", {
  ...id,
  ...timestamps,
  title: jsonb("title").notNull().default({}),
  summary: jsonb("summary").default({}),
  content: jsonb("content").default({}),
  status: newsStatusEnum("status").notNull().default("draft"),
  isPublic: boolean("is_public").notNull().default(true),
  archived,
  baseLanguage,
  availableLocales,
  publishedAt: timestamp("published_at", {
    mode: "string",
    withTimezone: true,
    precision: 3,
  }),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
});
