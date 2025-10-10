export enum QuestionIcons {
  MultiSelect = "MultiSelect",
  SingleSelect = "SingleSelect",
  TrueOrFalse = "TrueOrFalse",
  BriefResponse = "BriefResponse",
  DetailedResponse = "DetailedResponse",
  PhotoQuestion = "PhotoQuestion",
  FillInTheBlanks = "FillInTheBlanks",
  GapFill = "GapFill",
  MatchWords = "Equal",
  Scale_1_5 = "Questionnaire",
}

export type QuestionOption = {
  id?: string;
  sortableId: string;
  optionText: string;
  isCorrect: boolean;
  displayOrder: number;
  matchedWord?: string;
  scaleAnswer?: number;
};

export type Question = {
  id?: string;
  sortableId: string;
  type: QuestionType;
  description?: string;
  photoS3Key?: string;
  photoS3SingedUrl?: string;
  displayOrder: number;
  title: string;
  options?: QuestionOption[];
};

export enum QuestionType {
  SINGLE_CHOICE = "single_choice",
  MATCH_WORDS = "match_words",
  MULTIPLE_CHOICE = "multiple_choice",
  TRUE_OR_FALSE = "true_or_false",
  BRIEF_RESPONSE = "brief_response",
  DETAILED_RESPONSE = "detailed_response",
  PHOTO_QUESTION_SINGLE_CHOICE = "photo_question_single_choice",
  PHOTO_QUESTION_MULTIPLE_CHOICE = "photo_question_multiple_choice",
  FILL_IN_THE_BLANKS_TEXT = "fill_in_the_blanks_text",
  FILL_IN_THE_BLANKS_DND = "fill_in_the_blanks_dnd",
  SCALE_1_5 = "scale_1_5",
}
