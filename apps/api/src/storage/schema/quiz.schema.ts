import {
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_LIMIT_MODES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES,
  ASSESSMENT_FEEDBACK_MODES,
  ASSESSMENT_TEXT_COMPARISON_MODES,
  type AssessmentAnswerGradingStatus,
  type AssessmentAttemptGradingStatus,
  type AssessmentAttemptLimitMode,
  type AssessmentAttemptResult,
  type AssessmentAttemptSubmissionStatus,
  type AssessmentFeedbackMode,
  type AssessmentTextComparisonMode,
  type AssessmentGradingMode,
  type AssessmentQuestionType,
  type SupportedLanguages,
} from "@repo/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  interval,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  availableLocales,
  baseLanguage,
  id,
  tenantId,
  timestampWithTimezone,
  timestamps,
  withTenantIdIndex,
} from "./utils";

import { lessons, users } from ".";

export const assessments = pgTable(
  "assessments",
  {
    ...id,
    lessonId: uuid("lesson_id")
      .references(() => lessons.id, { onDelete: "cascade" })
      .notNull(),
    passingScorePercentage: numeric("passing_score_percentage", {
      precision: 5,
      scale: 2,
    }).notNull(),
    attemptLimitMode: text("attempt_limit_mode")
      .$type<AssessmentAttemptLimitMode>()
      .notNull()
      .default(ASSESSMENT_ATTEMPT_LIMIT_MODES.NONE),
    maximumAttempts: integer("maximum_attempts"),
    attemptCooldown: interval("attempt_cooldown"),
    feedbackMode: text("feedback_mode")
      .$type<AssessmentFeedbackMode>()
      .notNull()
      .default(ASSESSMENT_FEEDBACK_MODES.FULL),
    baseLanguage,
    availableLocales,
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessments", (table) => ({
    lessonIdx: index("assessments_tenant_id_lesson_id_idx").on(table.tenantId, table.lessonId),
    lessonUniqueIdx: uniqueIndex("assessments_tenant_id_lesson_id_unique_idx").on(
      table.tenantId,
      table.lessonId,
    ),
    idTenantUniqueIdx: uniqueIndex("assessments_tenant_id_id_unique_idx").on(
      table.tenantId,
      table.id,
    ),
    passingScorePercentageCheck: check(
      "assessments_passing_score_percentage_check",
      sql`${table.passingScorePercentage} BETWEEN 0 AND 100`,
    ),
    attemptLimitModeCheck: check(
      "assessments_attempt_limit_mode_check",
      sql`(
        (${table.attemptLimitMode} = 'none' AND ${table.maximumAttempts} IS NULL AND ${table.attemptCooldown} IS NULL)
        OR (${table.attemptLimitMode} = 'lifetime' AND ${table.maximumAttempts} > 0 AND ${table.attemptCooldown} IS NULL)
        OR (${table.attemptLimitMode} = 'cooldown_window' AND ${table.maximumAttempts} > 0 AND ${table.attemptCooldown} > interval '0')
      )`,
    ),
  })),
);

export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    ...id,
    assessmentId: uuid("assessment_id")
      .references(() => assessments.id, { onDelete: "cascade" })
      .notNull(),
    questionType: text("question_type").$type<AssessmentQuestionType>().notNull(),
    displayOrder: integer("display_order").notNull(),
    maximumPoints: numeric("maximum_points", { precision: 8, scale: 2 }).notNull().default("1"),
    gradingMode: text("grading_mode").$type<AssessmentGradingMode>().notNull(),
    prompt: jsonb("prompt").notNull().default({}),
    title: jsonb("title"),
    description: jsonb("description"),
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessment_questions", (table) => ({
    assessmentDisplayOrderUniqueIdx: uniqueIndex(
      "assessment_questions_tenant_assessment_display_order_idx",
    ).on(table.tenantId, table.assessmentId, table.displayOrder),
    assessmentDisplayOrderIdx: index(
      "assessment_questions_tenant_assessment_display_order_lookup_idx",
    ).on(table.tenantId, table.assessmentId, table.displayOrder),
    displayOrderCheck: check(
      "assessment_questions_display_order_check",
      sql`${table.displayOrder} >= 1`,
    ),
    maximumPointsCheck: check(
      "assessment_questions_maximum_points_check",
      sql`${table.maximumPoints} > 0`,
    ),
  })),
);

export const assessmentQuestionChoiceOptions = pgTable(
  "assessment_question_choice_options",
  {
    ...id,
    questionId: uuid("question_id")
      .references(() => assessmentQuestions.id, { onDelete: "cascade" })
      .notNull(),
    language: text("language").$type<SupportedLanguages>().notNull(),
    displayOrder: integer("display_order").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    label: text("label").notNull(),
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessment_question_choice_options", (table) => ({
    questionLanguageDisplayOrderUniqueIdx: uniqueIndex(
      "assessment_question_choice_options_tenant_question_language_display_order_idx",
    ).on(table.tenantId, table.questionId, table.language, table.displayOrder),
    questionLanguageDisplayOrderIdx: index(
      "assessment_question_choice_options_tenant_question_language_display_order_lookup_idx",
    ).on(table.tenantId, table.questionId, table.language, table.displayOrder),
    displayOrderCheck: check(
      "assessment_question_choice_options_display_order_check",
      sql`${table.displayOrder} >= 1`,
    ),
    labelCheck: check(
      "assessment_question_choice_options_label_check",
      sql`length(trim(${table.label})) > 0`,
    ),
  })),
);

export const assessmentQuestionTrueFalseStatements = pgTable(
  "assessment_question_true_false_statements",
  {
    ...id,
    questionId: uuid("question_id")
      .references(() => assessmentQuestions.id, { onDelete: "cascade" })
      .notNull(),
    language: text("language").$type<SupportedLanguages>().notNull(),
    displayOrder: integer("display_order").notNull(),
    correctValue: boolean("correct_value").notNull(),
    statement: text("statement").notNull(),
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessment_question_true_false_statements", (table) => ({
    questionLanguageDisplayOrderUniqueIdx: uniqueIndex(
      "assessment_question_true_false_statements_tenant_question_language_display_order_idx",
    ).on(table.tenantId, table.questionId, table.language, table.displayOrder),
    questionLanguageDisplayOrderIdx: index(
      "assessment_question_true_false_statements_tenant_question_language_display_order_lookup_idx",
    ).on(table.tenantId, table.questionId, table.language, table.displayOrder),
    displayOrderCheck: check(
      "assessment_question_true_false_statements_display_order_check",
      sql`${table.displayOrder} >= 1`,
    ),
    statementCheck: check(
      "assessment_question_true_false_statements_statement_check",
      sql`length(trim(${table.statement})) > 0`,
    ),
  })),
);

export const assessmentQuestionScaleOptions = pgTable(
  "assessment_question_scale_options",
  {
    ...id,
    questionId: uuid("question_id")
      .references(() => assessmentQuestions.id, { onDelete: "cascade" })
      .notNull(),
    scaleValue: smallint("scale_value").notNull(),
    displayOrder: integer("display_order").notNull(),
    label: jsonb("label").notNull().default({}),
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessment_question_scale_options", (table) => ({
    questionScaleValueUniqueIdx: uniqueIndex(
      "assessment_question_scale_options_tenant_question_value_idx",
    ).on(table.tenantId, table.questionId, table.scaleValue),
    questionDisplayOrderUniqueIdx: uniqueIndex(
      "assessment_question_scale_options_tenant_question_display_order_idx",
    ).on(table.tenantId, table.questionId, table.displayOrder),
    questionDisplayOrderIdx: index(
      "assessment_question_scale_options_tenant_question_display_order_lookup_idx",
    ).on(table.tenantId, table.questionId, table.displayOrder),
    scaleValueCheck: check(
      "assessment_question_scale_options_scale_value_check",
      sql`${table.scaleValue} BETWEEN 1 AND 5`,
    ),
    displayOrderCheck: check(
      "assessment_question_scale_options_display_order_check",
      sql`${table.displayOrder} >= 1`,
    ),
  })),
);

export const assessmentQuestionOpenTextSettings = pgTable(
  "assessment_question_open_text_settings",
  {
    questionId: uuid("question_id")
      .references(() => assessmentQuestions.id, { onDelete: "cascade" })
      .primaryKey(),
    minimumCharacters: integer("minimum_characters"),
    maximumCharacters: integer("maximum_characters"),
    reviewerInstructions: text("reviewer_instructions"),
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessment_question_open_text_settings", (table) => ({
    characterBoundsCheck: check(
      "assessment_question_open_text_settings_character_bounds_check",
      sql`${table.minimumCharacters} IS NULL OR ${table.minimumCharacters} >= 0`,
    ),
    maximumCharactersCheck: check(
      "assessment_question_open_text_settings_maximum_characters_check",
      sql`${table.maximumCharacters} IS NULL OR ${table.maximumCharacters} > 0`,
    ),
    characterOrderCheck: check(
      "assessment_question_open_text_settings_character_order_check",
      sql`${table.minimumCharacters} IS NULL OR ${table.maximumCharacters} IS NULL OR ${table.minimumCharacters} <= ${table.maximumCharacters}`,
    ),
  })),
);

export const assessmentQuestionBlanks = pgTable(
  "assessment_question_blanks",
  {
    ...id,
    questionId: uuid("question_id")
      .references(() => assessmentQuestions.id, { onDelete: "cascade" })
      .notNull(),
    textComparisonMode: text("text_comparison_mode")
      .$type<AssessmentTextComparisonMode>()
      .notNull()
      .default(ASSESSMENT_TEXT_COMPARISON_MODES.EXACT),
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessment_question_blanks", (table) => ({
    questionIdx: index("assessment_question_blanks_tenant_question_idx").on(
      table.tenantId,
      table.questionId,
    ),
  })),
);

export const assessmentQuestionBlankAnswerSets = pgTable(
  "assessment_question_blank_answer_sets",
  {
    blankId: uuid("blank_id")
      .references(() => assessmentQuestionBlanks.id, { onDelete: "cascade" })
      .notNull(),
    language: text("language").$type<SupportedLanguages>().notNull(),
    preferredAnswer: text("preferred_answer").notNull(),
    acceptedAnswers: text("accepted_answers").array().notNull(),
    ...timestamps,
    tenantId,
  },
  (table) => ({
    ...withTenantIdIndex("assessment_question_blank_answer_sets")(table),
    primaryKey: primaryKey({ columns: [table.tenantId, table.blankId, table.language] }),
    languageBlankIdx: index(
      "assessment_question_blank_answer_sets_tenant_language_target_blank_idx",
    ).on(table.tenantId, table.language, table.blankId),
  }),
);

export const assessmentQuestionDragAndDropOptions = pgTable(
  "assessment_question_drag_and_drop_options",
  {
    ...id,
    questionId: uuid("question_id")
      .references(() => assessmentQuestions.id, { onDelete: "cascade" })
      .notNull(),
    language: text("language").$type<SupportedLanguages>().notNull(),
    label: text("label").notNull(),
    targetBlankId: uuid("target_blank_id").references(() => assessmentQuestionBlanks.id, {
      onDelete: "cascade",
    }),
    displayOrder: integer("display_order").notNull(),
    ...timestamps,
    tenantId,
  },
  withTenantIdIndex("assessment_question_drag_and_drop_options", (table) => ({
    questionLanguageDisplayOrderUniqueIdx: uniqueIndex(
      "assessment_question_drag_and_drop_options_tenant_question_language_display_order_idx",
    ).on(table.tenantId, table.questionId, table.language, table.displayOrder),
    questionLanguageDisplayOrderIdx: index(
      "assessment_question_drag_and_drop_options_tenant_question_language_display_order_lookup_idx",
    ).on(table.tenantId, table.questionId, table.language, table.displayOrder),
    targetBlankIdx: index("assessment_question_drag_and_drop_options_tenant_target_blank_idx")
      .on(table.tenantId, table.targetBlankId)
      .where(sql`${table.targetBlankId} IS NOT NULL`),
    displayOrderCheck: check(
      "assessment_question_drag_and_drop_options_display_order_check",
      sql`${table.displayOrder} >= 1`,
    ),
    labelCheck: check(
      "assessment_question_drag_and_drop_options_label_check",
      sql`length(trim(${table.label})) > 0`,
    ),
  })),
);

export const assessmentAttempts = pgTable(
  "assessment_attempts",
  {
    ...id,
    assessmentId: uuid("assessment_id")
      .references(() => assessments.id, { onDelete: "cascade" })
      .notNull(),
    language: text("language").$type<SupportedLanguages>().notNull(),
    learnerId: uuid("learner_id")
      .references(() => users.id)
      .notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    submissionStatus: text("submission_status")
      .$type<AssessmentAttemptSubmissionStatus>()
      .notNull()
      .default(ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED),
    gradingStatus: text("grading_status")
      .$type<AssessmentAttemptGradingStatus>()
      .notNull()
      .default(ASSESSMENT_ATTEMPT_GRADING_STATUSES.PENDING),
    result: text("result")
      .$type<AssessmentAttemptResult>()
      .notNull()
      .default(ASSESSMENT_ATTEMPT_RESULTS.PENDING),
    availablePoints: numeric("available_points", { precision: 10, scale: 2 }).notNull(),
    awardedPoints: numeric("awarded_points", { precision: 10, scale: 2 }),
    scorePercentage: numeric("score_percentage", { precision: 5, scale: 2 }),
    hasQuestionLevelAnswers: boolean("has_question_level_answers").notNull().default(true),
    startedAt: timestampWithTimezone({ name: "started_at" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    submittedAt: timestampWithTimezone({ name: "submitted_at" }).notNull(),
    gradedAt: timestampWithTimezone({ name: "graded_at" }),
    tenantId,
  },
  (table) => ({
    ...withTenantIdIndex("assessment_attempts")(table),
    attemptUniqueIdx: uniqueIndex("assessment_attempts_tenant_assessment_learner_number_idx").on(
      table.tenantId,
      table.assessmentId,
      table.learnerId,
      table.attemptNumber,
    ),
    learnerAssessmentStartedIdx: index(
      "assessment_attempts_tenant_learner_assessment_started_idx",
    ).on(table.tenantId, table.learnerId, table.assessmentId, table.startedAt),
    assessmentLanguageIdx: index("assessment_attempts_tenant_assessment_language_idx").on(
      table.tenantId,
      table.assessmentId,
      table.language,
    ),
    gradingQueueIdx: index("assessment_attempts_tenant_grading_submitted_idx").on(
      table.tenantId,
      table.gradingStatus,
      table.submittedAt,
    ),
    attemptNumberCheck: check(
      "assessment_attempts_attempt_number_check",
      sql`${table.attemptNumber} >= 1`,
    ),
    availablePointsCheck: check(
      "assessment_attempts_available_points_check",
      sql`${table.availablePoints} > 0`,
    ),
    scorePercentageCheck: check(
      "assessment_attempts_score_percentage_check",
      sql`${table.scorePercentage} IS NULL OR ${table.scorePercentage} BETWEEN 0 AND 100`,
    ),
  }),
);

export const assessmentAttemptQuestionAnswers = pgTable(
  "assessment_attempt_question_answers",
  {
    ...id,
    attemptId: uuid("attempt_id")
      .references(() => assessmentAttempts.id, { onDelete: "cascade" })
      .notNull(),
    questionId: uuid("question_id")
      .references(() => assessmentQuestions.id, { onDelete: "cascade" })
      .notNull(),
    gradingStatus: text("grading_status").$type<AssessmentAnswerGradingStatus>().notNull(),
    awardedPoints: numeric("awarded_points", { precision: 8, scale: 2 }),
    submittedAt: timestampWithTimezone({ name: "submitted_at" }).notNull(),
    tenantId,
  },
  (table) => ({
    ...withTenantIdIndex("assessment_attempt_question_answers")(table),
    attemptQuestionUniqueIdx: uniqueIndex(
      "assessment_attempt_question_answers_tenant_attempt_question_idx",
    ).on(table.tenantId, table.attemptId, table.questionId),
    attemptIdx: index("assessment_attempt_question_answers_tenant_attempt_idx").on(
      table.tenantId,
      table.attemptId,
    ),
    gradingQueueIdx: index("assessment_attempt_question_answers_tenant_grading_submitted_idx").on(
      table.tenantId,
      table.gradingStatus,
      table.submittedAt,
    ),
  }),
);

export const assessmentAttemptChoiceSelections = pgTable(
  "assessment_attempt_choice_selections",
  {
    questionAnswerId: uuid("question_answer_id")
      .references(() => assessmentAttemptQuestionAnswers.id, { onDelete: "cascade" })
      .notNull(),
    selectedOptionId: uuid("selected_option_id")
      .references(() => assessmentQuestionChoiceOptions.id, { onDelete: "cascade" })
      .notNull(),
    tenantId,
  },
  (table) => ({
    ...withTenantIdIndex("assessment_attempt_choice_selections")(table),
    primaryKey: primaryKey({
      columns: [table.tenantId, table.questionAnswerId, table.selectedOptionId],
    }),
    selectedOptionIdx: index("assessment_attempt_choice_selections_tenant_option_idx").on(
      table.tenantId,
      table.selectedOptionId,
    ),
  }),
);

export const assessmentAttemptStatementAnswers = pgTable(
  "assessment_attempt_statement_answers",
  {
    questionAnswerId: uuid("question_answer_id")
      .references(() => assessmentAttemptQuestionAnswers.id, { onDelete: "cascade" })
      .notNull(),
    statementId: uuid("statement_id")
      .references(() => assessmentQuestionTrueFalseStatements.id, { onDelete: "cascade" })
      .notNull(),
    submittedValue: boolean("submitted_value").notNull(),
    tenantId,
  },
  (table) => ({
    ...withTenantIdIndex("assessment_attempt_statement_answers")(table),
    primaryKey: primaryKey({
      columns: [table.tenantId, table.questionAnswerId, table.statementId],
    }),
    statementIdx: index("assessment_attempt_statement_answers_tenant_statement_idx").on(
      table.tenantId,
      table.statementId,
    ),
  }),
);

export const assessmentAttemptBlankAnswers = pgTable(
  "assessment_attempt_blank_answers",
  {
    questionAnswerId: uuid("question_answer_id")
      .references(() => assessmentAttemptQuestionAnswers.id, { onDelete: "cascade" })
      .notNull(),
    blankId: uuid("blank_id")
      .references(() => assessmentQuestionBlanks.id, { onDelete: "cascade" })
      .notNull(),
    submittedText: text("submitted_text"),
    selectedDragOptionId: uuid("selected_drag_option_id").references(
      () => assessmentQuestionDragAndDropOptions.id,
      {
        onDelete: "cascade",
      },
    ),
    tenantId,
  },
  (table) => ({
    ...withTenantIdIndex("assessment_attempt_blank_answers")(table),
    primaryKey: primaryKey({
      columns: [table.tenantId, table.questionAnswerId, table.blankId],
    }),
    selectedOptionIdx: index("assessment_attempt_blank_answers_tenant_selected_option_idx").on(
      table.tenantId,
      table.selectedDragOptionId,
    ),
  }),
);

export const assessmentAttemptOpenTextAnswers = pgTable(
  "assessment_attempt_open_text_answers",
  {
    questionAnswerId: uuid("question_answer_id")
      .references(() => assessmentAttemptQuestionAnswers.id, { onDelete: "cascade" })
      .primaryKey(),
    submittedText: text("submitted_text").notNull(),
    tenantId,
  },
  withTenantIdIndex("assessment_attempt_open_text_answers"),
);

export const assessmentAttemptScaleSelections = pgTable(
  "assessment_attempt_scale_selections",
  {
    questionAnswerId: uuid("question_answer_id")
      .references(() => assessmentAttemptQuestionAnswers.id, { onDelete: "cascade" })
      .primaryKey(),
    selectedScaleOptionId: uuid("selected_scale_option_id")
      .references(() => assessmentQuestionScaleOptions.id, { onDelete: "cascade" })
      .notNull(),
    tenantId,
  },
  withTenantIdIndex("assessment_attempt_scale_selections"),
);

export const assessmentAttemptQuestionAnswerReviews = pgTable(
  "assessment_attempt_question_answer_reviews",
  {
    ...id,
    questionAnswerId: uuid("question_answer_id")
      .references(() => assessmentAttemptQuestionAnswers.id, { onDelete: "cascade" })
      .notNull(),
    revisionNumber: integer("revision_number").notNull(),
    reviewerId: uuid("reviewer_id")
      .references(() => users.id)
      .notNull(),
    awardedPoints: numeric("awarded_points", { precision: 8, scale: 2 }).notNull(),
    explanation: text("explanation").notNull(),
    explanationLanguage: text("explanation_language").$type<SupportedLanguages>().notNull(),
    reviewedAt: timestampWithTimezone({ name: "reviewed_at" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    tenantId,
  },
  withTenantIdIndex("assessment_attempt_question_answer_reviews", (table) => ({
    attemptRevisionUniqueIdx: uniqueIndex(
      "assessment_attempt_question_answer_reviews_tenant_attempt_revisionNumber_idx",
    ).on(table.tenantId, table.questionAnswerId, table.revisionNumber),
    attemptRevisionIdx: index(
      "assessment_attempt_question_answer_reviews_tenant_attempt_revisionNumber_lookup_idx",
    ).on(table.tenantId, table.questionAnswerId, table.revisionNumber),
    reviewerCreatedIdx: index(
      "assessment_attempt_question_answer_reviews_tenant_reviewer_created_idx",
    ).on(table.tenantId, table.reviewerId, table.reviewedAt),
    revisionNumberCheck: check(
      "assessment_attempt_question_answer_reviews_revisionNumber_check",
      sql`${table.revisionNumber} >= 1`,
    ),
    explanationCheck: check(
      "assessment_attempt_question_answer_reviews_explanation_check",
      sql`length(trim(${table.explanation})) > 0`,
    ),
  })),
);
