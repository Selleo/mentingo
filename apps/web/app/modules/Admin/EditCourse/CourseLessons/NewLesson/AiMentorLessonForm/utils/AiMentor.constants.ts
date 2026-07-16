export type SuggestionType =
  | "scenarioSimulation"
  | "problemSolving"
  | "creativeTask"
  | "knowledgeSharing";

export type SuggestionsButton = {
  onClick: SuggestionType;
  translationKey: string;
};

export const SUGGESTION_EXAMPLES = {
  scenarioSimulation: {
    instructions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.scenarioSimulation",
    assessmentCriteria:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.scenarioSimulation",
    blockingError:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.blockingErrors.scenarioSimulation",
    acceptedExamplesPrefix:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.acceptedExamples.scenarioSimulation",
    criteriaCount: 5,
    passingThresholdPercent: 60,
  },
  problemSolving: {
    instructions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.problemSolving",
    assessmentCriteria:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.problemSolving",
    blockingError:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.blockingErrors.problemSolving",
    acceptedExamplesPrefix:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.acceptedExamples.problemSolving",
    criteriaCount: 5,
    passingThresholdPercent: 60,
  },
  creativeTask: {
    instructions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.creativeTask",
    assessmentCriteria:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.creativeTask",
    blockingError:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.blockingErrors.creativeTask",
    acceptedExamplesPrefix:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.acceptedExamples.creativeTask",
    criteriaCount: 4,
    passingThresholdPercent: 100,
  },
  knowledgeSharing: {
    instructions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.knowledgeSharing",
    assessmentCriteria:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.knowledgeSharing",
    blockingError:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.blockingErrors.knowledgeSharing",
    acceptedExamplesPrefix:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.acceptedExamples.knowledgeSharing",
    criteriaCount: 3,
    passingThresholdPercent: 1,
  },
} as const;

export const SUGGESTION_SCORE_GUIDANCE = {
  notMetDescription:
    "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.scoreGuidance.notMetDescription",
  notMetExample:
    "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.scoreGuidance.notMetExample",
  metDescription:
    "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.scoreGuidance.metDescription",
} as const;

export const SuggestionExamples: SuggestionsButton[] = [
  {
    onClick: "scenarioSimulation",
    translationKey: "adminCourseView.curriculum.lesson.other.scenarioSimulation",
  },
  {
    onClick: "problemSolving",
    translationKey: "adminCourseView.curriculum.lesson.other.problemSolving",
  },
  {
    onClick: "creativeTask",
    translationKey: "adminCourseView.curriculum.lesson.other.creativeTask",
  },
  {
    onClick: "knowledgeSharing",
    translationKey: "adminCourseView.curriculum.lesson.other.knowledgeSharing",
  },
];

export const FORM_LIMITS = {
  MAX_INSTRUCTIONS_LENGTH: 2000,
  MAX_COMPLETION_CONDITIONS_LENGTH: 1000,
} as const;

export const FILE_TYPES_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

export const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt";

export const ACCEPTED_FILE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
