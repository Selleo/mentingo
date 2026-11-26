import { AI_MENTOR_TEACHING_STYLE, AI_MENTOR_TYPE } from "@repo/shared";

export const ENGLISH_INSTRUCTIONS = "<p>Lead the learner through an English scenario.</p>";
export const POLISH_INSTRUCTIONS = "<p>Lead the learner through a Polish scenario.</p>";

export const TEACHER_CONFIGURATION = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Guide the learner through the practice",
  expertise: "Sales negotiation",
  contentScope: "Discovery and objection handling",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
  additionalInstructions: ENGLISH_INSTRUCTIONS,
};

export const POLISH_TEACHER_CONFIGURATION = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Przeprowadź ucznia przez ćwiczenie",
  expertise: "Negocjacje sprzedażowe",
  contentScope: "Badanie potrzeb i obiekcje",
  additionalInstructions: POLISH_INSTRUCTIONS,
};

export const AI_MENTOR_LESSON_BODY = {
  title: "Negotiation practice",
  description: "<p>Practice a sales call.</p>",
  aiMentorConfiguration: TEACHER_CONFIGURATION,
  aiJudgeConfiguration: {
    taskGoal: "Complete the negotiation practice",
    passingThresholdPercent: 0,
    criteria: [],
    blockingErrors: [],
  },
  name: "AI Mentor",
};

const scoredCriterion = (title: string, expectedBehavior: string, missed: string, met: string) => ({
  title,
  expectedBehavior,
  maxScore: 1,
  scoreGuidance: [
    { score: 0, description: missed },
    { score: 1, description: met },
  ],
});

export const SALES_JUDGE_CONFIGURATION = {
  taskGoal: "Handle a sales objection and agree a next step",
  passingThresholdPercent: 70,
  criteria: [
    scoredCriterion(
      "Discovery",
      "Asks relevant discovery questions",
      "Does not ask a relevant question",
      "Asks a relevant question",
    ),
    scoredCriterion(
      "Response",
      "Responds directly to the objection",
      "Does not address the objection",
      "Addresses the objection directly",
    ),
    scoredCriterion(
      "Next step",
      "Agrees a concrete next step",
      "Does not agree a next step",
      "Agrees a concrete next step",
    ),
  ],
  blockingErrors: [{ description: "Invents unsupported product facts" }],
};

export const DISCOVERY_JUDGE_CONFIGURATION = {
  taskGoal: "Discover the customer's needs and agree a next step",
  passingThresholdPercent: 50,
  criteria: [
    {
      title: "Discovery",
      expectedBehavior: "Asks at least one relevant discovery question",
      maxScore: 1,
      scoreGuidance: [
        {
          score: 0,
          description: "Does not ask a relevant discovery question",
          example: "Immediately presents an offer",
        },
        {
          score: 1,
          description: "Asks a relevant discovery question",
          example: "What problem are you trying to solve?",
        },
      ],
    },
  ],
  blockingErrors: [{ description: "Invents unsupported product capabilities" }],
};

export const POLISH_DISCOVERY_TRANSLATION = {
  taskGoal: "Poznaj potrzeby klienta i uzgodnij kolejny krok",
  criterion: {
    title: "Analiza potrzeb",
    expectedBehavior: "Zadaje co najmniej jedno trafne pytanie o potrzeby",
  },
  zeroScoreGuidance: {
    description: "Nie zadaje trafnego pytania o potrzeby",
    example: "Od razu przedstawia ofertę",
  },
  fullScoreGuidance: {
    description: "Zadaje trafne pytanie o potrzeby",
    example: "Jaki problem chcesz rozwiązać?",
  },
  blockingError: { description: "Wymyśla nieistniejące możliwości produktu" },
};

export const JUDGE_CONFIGURATION_READERS = {
  ANONYMOUS: "an anonymous visitor",
  STUDENT: "a student",
} as const;

export type JudgeConfigurationReader =
  (typeof JUDGE_CONFIGURATION_READERS)[keyof typeof JUDGE_CONFIGURATION_READERS];

export const JUDGE_CONFIGURATION_REJECTION_CASES = [
  { reader: JUDGE_CONFIGURATION_READERS.ANONYMOUS, expectedStatus: 401 },
  { reader: JUDGE_CONFIGURATION_READERS.STUDENT, expectedStatus: 403 },
];
