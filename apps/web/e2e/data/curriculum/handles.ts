import type { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

export const LESSON_TYPE_OPTION_HANDLES = {
  CONTENT: "content",
  QUIZ: "quiz",
  AI_MENTOR: "ai_mentor",
  EMBED: "embed",
  SCORM: "scorm",
} as const;

export const CURRICULUM_HANDLES = {
  ROOT: "curriculum-root",
  CHAPTER_LIST: "curriculum-chapter-list",
  ADD_CHAPTER_BUTTON: "curriculum-add-chapter-button",
  COURSE_GENERATION_BUTTON: "curriculum-course-generation-button",
  chapterCard: (chapterId: string) => `curriculum-chapter-card-${chapterId}`,
  chapterDragHandle: (chapterId: string) => `curriculum-chapter-drag-handle-${chapterId}`,
  chapterAccordion: (chapterId: string) => `curriculum-chapter-accordion-${chapterId}`,
  chapterFreemiumSwitch: (chapterId: string) => `curriculum-chapter-freemium-switch-${chapterId}`,
  addLessonButton: (chapterId: string) => `curriculum-add-lesson-button-${chapterId}`,
  lessonCard: (lessonId: string) => `curriculum-lesson-card-${lessonId}`,
  lessonDragHandle: (lessonId: string) => `curriculum-lesson-drag-handle-${lessonId}`,
  lessonTitle: (lessonId: string) => `curriculum-lesson-title-${lessonId}`,
  lessonTypeOption: (
    type: (typeof LESSON_TYPE_OPTION_HANDLES)[keyof typeof LESSON_TYPE_OPTION_HANDLES],
  ) => `curriculum-lesson-type-option-${type}`,
} as const;

export const CHAPTER_FORM_HANDLES = {
  ROOT: "curriculum-chapter-form",
  TITLE_INPUT: "curriculum-chapter-title-input",
  SAVE_BUTTON: "curriculum-chapter-save-button",
  DELETE_BUTTON: "curriculum-chapter-delete-button",
  CANCEL_BUTTON: "curriculum-chapter-cancel-button",
} as const;

export const CONTENT_LESSON_FORM_HANDLES = {
  ROOT: "curriculum-content-lesson-form",
  TITLE_INPUT: "curriculum-content-lesson-title-input",
  DESCRIPTION_EDITOR: "curriculum-content-lesson-description-editor",
  SAVE_BUTTON: "curriculum-content-lesson-save-button",
  DELETE_BUTTON: "curriculum-content-lesson-delete-button",
  CANCEL_BUTTON: "curriculum-content-lesson-cancel-button",
} as const;

export const QUIZ_LESSON_FORM_HANDLES = {
  ROOT: "curriculum-quiz-lesson-form",
  TITLE_INPUT: "curriculum-quiz-lesson-title-input",
  SAVE_BUTTON: "curriculum-quiz-lesson-save-button",
  DELETE_BUTTON: "curriculum-quiz-lesson-delete-button",
  CANCEL_BUTTON: "curriculum-quiz-lesson-cancel-button",
  ADD_QUESTION_BUTTON: "curriculum-quiz-add-question-button",
  questionTypeOption: (type: QuestionType) => `curriculum-quiz-question-type-option-${type}`,
  questionCard: (questionIndex: number) => `curriculum-quiz-question-card-${questionIndex}`,
  questionTitleInput: (questionIndex: number) =>
    `curriculum-quiz-question-title-input-${questionIndex}`,
  questionToggle: (questionIndex: number) => `curriculum-quiz-question-toggle-${questionIndex}`,
  questionDeleteButton: (questionIndex: number) =>
    `curriculum-quiz-question-delete-button-${questionIndex}`,
  addOptionButton: (questionIndex: number) =>
    `curriculum-quiz-question-add-option-button-${questionIndex}`,
  optionInput: (questionIndex: number, optionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-option-${optionIndex}-input`,
  correctOptionControl: (questionIndex: number, optionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-option-${optionIndex}-correct`,
  fillBlanksEditor: (questionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-fill-blanks-editor`,
  addWordButton: (questionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-add-word-button`,
  newWordInput: (questionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-new-word-input`,
  saveWordButton: (questionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-save-word-button`,
  dragWordButton: (questionIndex: number, word: string) =>
    `curriculum-quiz-question-${questionIndex}-drag-word-${word}`,
  photoUploadInput: (questionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-photo-upload-input`,
  photoTypeSelect: (questionIndex: number) =>
    `curriculum-quiz-question-${questionIndex}-photo-type-select`,
  photoTypeOption: (questionIndex: number, type: QuestionType) =>
    `curriculum-quiz-question-${questionIndex}-photo-type-option-${type}`,
} as const;

export const EMBED_LESSON_FORM_HANDLES = {
  ROOT: "curriculum-embed-lesson-form",
  TITLE_INPUT: "curriculum-embed-lesson-title-input",
  SAVE_BUTTON: "curriculum-embed-lesson-save-button",
  ADD_RESOURCE_BUTTON: "curriculum-embed-lesson-add-resource-button",
  DELETE_BUTTON: "curriculum-embed-lesson-delete-button",
  CANCEL_BUTTON: "curriculum-embed-lesson-cancel-button",
  resourceCard: (resourceIndex: number) => `curriculum-embed-resource-card-${resourceIndex}`,
  resourceUrlInput: (resourceIndex: number) =>
    `curriculum-embed-resource-${resourceIndex}-url-input`,
  resourceFullscreenCheckbox: (resourceIndex: number) =>
    `curriculum-embed-resource-${resourceIndex}-fullscreen-checkbox`,
  removeResourceButton: (resourceIndex: number) =>
    `curriculum-embed-resource-${resourceIndex}-remove-button`,
} as const;

export const SCORM_LESSON_FORM_HANDLES = {
  ROOT: "curriculum-scorm-lesson-form",
  TITLE_INPUT: "curriculum-scorm-lesson-title-input",
  PACKAGE_UPLOAD: "curriculum-scorm-lesson-package-upload",
  PACKAGE_INPUT: "curriculum-scorm-lesson-package-input",
  PACKAGE_SELECTED_FILE: "curriculum-scorm-lesson-package-selected-file",
  PACKAGE_READONLY: "curriculum-scorm-lesson-package-readonly",
  PACKAGE_INFO_TOOLTIP_TRIGGER: "curriculum-scorm-lesson-package-info-tooltip-trigger",
  PACKAGE_REMOVE_BUTTON: "curriculum-scorm-lesson-package-remove-button",
  PACKAGE_REPLACE_BUTTON: "curriculum-scorm-lesson-package-replace-button",
  SAVE_BUTTON: "curriculum-scorm-lesson-save-button",
  DELETE_BUTTON: "curriculum-scorm-lesson-delete-button",
  CANCEL_BUTTON: "curriculum-scorm-lesson-cancel-button",
  DELETE_DIALOG: "curriculum-scorm-lesson-delete-dialog",
  DELETE_DIALOG_CONFIRM_BUTTON: "curriculum-scorm-lesson-delete-dialog-confirm-button",
  DELETE_DIALOG_CANCEL_BUTTON: "curriculum-scorm-lesson-delete-dialog-cancel-button",
} as const;

export const AI_MENTOR_LESSON_FORM_HANDLES = {
  ROOT: "curriculum-ai-mentor-lesson-form",
  TITLE_INPUT: "curriculum-ai-mentor-lesson-title-input",
  DESCRIPTION_INPUT: "curriculum-ai-mentor-lesson-description-input",
  NAME_INPUT: "curriculum-ai-mentor-lesson-name-input",
  INSTRUCTIONS_INPUT: "curriculum-ai-mentor-lesson-instructions-input",
  COMPLETION_CONDITIONS_INPUT: "curriculum-ai-mentor-lesson-completion-conditions-input",
  TYPE_SELECT: "curriculum-ai-mentor-lesson-type-select",
  SAVE_BUTTON: "curriculum-ai-mentor-lesson-save-button",
  DELETE_BUTTON: "curriculum-ai-mentor-lesson-delete-button",
  CANCEL_BUTTON: "curriculum-ai-mentor-lesson-cancel-button",
  PREVIEW_BUTTON: "curriculum-ai-mentor-lesson-preview-button",
  RESOURCE_FILE_INPUT: "curriculum-ai-mentor-lesson-resource-file-input",
  AVATAR_FILE_INPUT: "curriculum-ai-mentor-lesson-avatar-file-input",
} as const;

export const COURSE_GENERATION_HANDLES = {
  DRAWER: "course-generation-drawer",
  CLOSE_BUTTON: "course-generation-close-button",
  PROMPT_INPUT: "course-generation-prompt-input",
  SEND_BUTTON: "course-generation-send-button",
  ATTACH_FILE_BUTTON: "course-generation-attach-file-button",
  FILE_INPUT: "course-generation-file-input",
  VOICE_BUTTON: "course-generation-voice-button",
  FILE_CARD: "course-generation-file-card",
  PROGRESS_STRIP: "course-generation-progress-strip",
  COMPLETED_NOTICE: "course-generation-completed-notice",
  messageRole: (role: string) => `course-generation-message-${role}`,
} as const;
