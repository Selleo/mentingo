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
    conditions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.scenarioSimulation",
  },
  problemSolving: {
    instructions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.problemSolving",
    conditions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.problemSolving",
  },
  creativeTask: {
    instructions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.creativeTask",
    conditions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.creativeTask",
  },
  knowledgeSharing: {
    instructions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.knowledgeSharing",
    conditions:
      "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.knowledgeSharing",
  },
};

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
