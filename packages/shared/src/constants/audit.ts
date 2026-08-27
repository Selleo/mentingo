export const AUDIT_TYPES = {
  INDIVIDUAL: "individual",
  SCHOOL: "school",
} as const;

export type AuditType = (typeof AUDIT_TYPES)[keyof typeof AUDIT_TYPES];

export const isAuditType = (value: unknown): value is AuditType =>
  value === AUDIT_TYPES.INDIVIDUAL || value === AUDIT_TYPES.SCHOOL;

export const AUDIT_COMPETENCIES = {
  AI_LITERACY: "ai_literacy",
  AI_GOVERNANCE: "ai_governance",
  AI_AWARENESS: "ai_awareness",
  TOOL_PROFICIENCY: "tool_proficiency",
  ETHICAL_UNDERSTANDING: "ethical_understanding",
  CURRICULUM_INTEGRATION: "curriculum_integration",
  DATA_PRIVACY: "data_privacy",
  SENIOR_LEADERSHIP: "senior_leadership",
  SCIENCE_TECHNOLOGY: "science_technology",
  HUMANITIES: "humanities",
  ARTS_CREATIVE: "arts_creative",
  ADMINISTRATION: "administration",
  SUPPORT_STAFF: "support_staff",
} as const;

export type AuditCompetency = (typeof AUDIT_COMPETENCIES)[keyof typeof AUDIT_COMPETENCIES];

export type AuditAnswer = {
  questionId: string;
  optionId: string;
};

export type AuditQuestionOption = {
  id: string;
  score: number;
};

export type AuditQuestionDefinition = {
  id: string;
  competency: AuditCompetency;
  options: readonly AuditQuestionOption[];
};

export type AuditDefinition = {
  version: number;
  questions: readonly AuditQuestionDefinition[];
};

const FIVE_POINT_OPTIONS = [
  { id: "level_1", score: 0 },
  { id: "level_2", score: 25 },
  { id: "level_3", score: 50 },
  { id: "level_4", score: 75 },
  { id: "level_5", score: 100 },
] as const;

const INDIVIDUAL_V1 = {
  version: 1,
  questions: [
    {
      id: "individual_ai_confidence",
      competency: AUDIT_COMPETENCIES.AI_LITERACY,
      options: FIVE_POINT_OPTIONS,
    },
  ],
} as const satisfies AuditDefinition;

const SCHOOL_V1 = {
  version: 1,
  questions: [
    {
      id: "school_ai_policy_maturity",
      competency: AUDIT_COMPETENCIES.AI_GOVERNANCE,
      options: FIVE_POINT_OPTIONS,
    },
  ],
} as const satisfies AuditDefinition;

const INDIVIDUAL_V2 = {
  version: 2,
  questions: [
    {
      id: "individual_ai_awareness",
      competency: AUDIT_COMPETENCIES.AI_AWARENESS,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "individual_tool_proficiency",
      competency: AUDIT_COMPETENCIES.TOOL_PROFICIENCY,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "individual_ethical_understanding",
      competency: AUDIT_COMPETENCIES.ETHICAL_UNDERSTANDING,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "individual_curriculum_integration",
      competency: AUDIT_COMPETENCIES.CURRICULUM_INTEGRATION,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "individual_data_privacy",
      competency: AUDIT_COMPETENCIES.DATA_PRIVACY,
      options: FIVE_POINT_OPTIONS,
    },
  ],
} as const satisfies AuditDefinition;

const SCHOOL_V2 = {
  version: 2,
  questions: [
    {
      id: "school_senior_leadership",
      competency: AUDIT_COMPETENCIES.SENIOR_LEADERSHIP,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "school_science_technology",
      competency: AUDIT_COMPETENCIES.SCIENCE_TECHNOLOGY,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "school_humanities",
      competency: AUDIT_COMPETENCIES.HUMANITIES,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "school_arts_creative",
      competency: AUDIT_COMPETENCIES.ARTS_CREATIVE,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "school_administration",
      competency: AUDIT_COMPETENCIES.ADMINISTRATION,
      options: FIVE_POINT_OPTIONS,
    },
    {
      id: "school_support_staff",
      competency: AUDIT_COMPETENCIES.SUPPORT_STAFF,
      options: FIVE_POINT_OPTIONS,
    },
  ],
} as const satisfies AuditDefinition;

export const AUDIT_DEFINITION_VERSIONS: Record<
  AuditType,
  Readonly<Record<number, AuditDefinition>>
> = {
  [AUDIT_TYPES.INDIVIDUAL]: { 1: INDIVIDUAL_V1, 2: INDIVIDUAL_V2 },
  [AUDIT_TYPES.SCHOOL]: { 1: SCHOOL_V1, 2: SCHOOL_V2 },
};

export const AUDIT_DEFINITIONS: Record<AuditType, AuditDefinition> = {
  [AUDIT_TYPES.INDIVIDUAL]: INDIVIDUAL_V2,
  [AUDIT_TYPES.SCHOOL]: SCHOOL_V2,
};

export const getAuditDefinition = (type: AuditType, version: number) =>
  AUDIT_DEFINITION_VERSIONS[type][version];
