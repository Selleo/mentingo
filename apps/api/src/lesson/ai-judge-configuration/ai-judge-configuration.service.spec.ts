import { BadRequestException } from "@nestjs/common";
import {
  COURSE_FEATURE,
  ENTITY_TYPES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import {
  aiJudgeConfigurationInputSchema,
  updateAiJudgeConfigurationTranslationSchema,
} from "./ai-judge-configuration.schema";
import { AiJudgeConfigurationService } from "./ai-judge-configuration.service";

import type { AiJudgeConfigurationGraphService } from "./ai-judge-configuration-graph.service";
import type { AiJudgeConfigurationRepository } from "./ai-judge-configuration.repository";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CourseFeaturePolicyService } from "src/courses/course-feature-policy.service";
import type { MasterCourseService } from "src/courses/master-course.service";
import type { AdminLessonService } from "src/lesson/services/adminLesson.service";

const lessonId = "00000000-0000-4000-8000-000000000001" as UUIDType;
const aiMentorLessonId = "00000000-0000-4000-8000-000000000002" as UUIDType;
const configurationId = "00000000-0000-4000-8000-000000000003" as UUIDType;
const criterionId = "00000000-0000-4000-8000-000000000004" as UUIDType;
const guidanceId = "00000000-0000-4000-8000-000000000005" as UUIDType;
const blockingErrorId = "00000000-0000-4000-8000-000000000006" as UUIDType;
const tenantId = "00000000-0000-4000-8000-000000000007" as UUIDType;
const timestamp = "2026-07-13T10:00:00.000Z";
const createGuidance = (maxScore: number) =>
  Array.from({ length: maxScore + 1 }, (_, score) => ({
    score,
    description: `Guidance for score ${score}`,
  }));

const context = {
  lessonId,
  lessonType: LESSON_TYPES.AI_MENTOR,
  aiMentorLessonId,
  configurationId,
  baseLanguage: SUPPORTED_LANGUAGES.EN,
  availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
};

const input = {
  taskGoal: "Practice a sales conversation",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Discovery",
      expectedBehavior: "Asks discovery questions",
      maxScore: 5,
      scoreGuidance: createGuidance(5),
    },
    {
      title: "Recommendation",
      expectedBehavior: "Makes a relevant recommendation",
      maxScore: 3,
      scoreGuidance: createGuidance(3),
    },
    {
      title: "Next step",
      expectedBehavior: "Agrees a concrete next step",
      maxScore: 2,
      scoreGuidance: createGuidance(2),
    },
  ],
  blockingErrors: [],
};

describe("AiJudgeConfigurationService", () => {
  let service: AiJudgeConfigurationService;
  let repository: jest.Mocked<AiJudgeConfigurationRepository>;
  let graphService: jest.Mocked<AiJudgeConfigurationGraphService>;
  let db: DatabasePg;
  let adminLessonService: jest.Mocked<AdminLessonService>;
  let masterCourseService: jest.Mocked<MasterCourseService>;
  let courseFeaturePolicyService: jest.Mocked<CourseFeaturePolicyService>;
  const currentUser = {} as CurrentUserType;
  const mockLocalizedGraph = (
    graph: NonNullable<
      Awaited<ReturnType<AiJudgeConfigurationRepository["getConfigurationGraph"]>>
    >,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) => {
    const translate = (value: Record<string, string>) => value[language] ?? "";
    repository.getConfigurationInLanguage.mockResolvedValue([
      {
        id: graph.configuration.id,
        aiMentorLessonId: graph.configuration.aiMentorLessonId,
        taskGoal: translate(graph.configuration.taskGoal),
        passingThresholdPercent: graph.configuration.passingThresholdPercent,
      },
    ]);
    repository.getCriteriaInLanguage.mockResolvedValue(
      graph.criteria.map((criterion) => ({
        id: criterion.id,
        configurationId: criterion.configurationId,
        title: translate(criterion.title),
        expectedBehavior: translate(criterion.expectedBehavior),
        maxScore: criterion.maxScore,
      })),
    );
    repository.getScoreGuidanceInLanguage.mockResolvedValue(
      graph.scoreGuidance.map((guidance) => ({
        id: guidance.id,
        criterionId: guidance.criterionId,
        score: guidance.score,
        description: translate(guidance.description),
        example: guidance.example ? translate(guidance.example) : "",
      })),
    );
    repository.getBlockingErrorsInLanguage.mockResolvedValue(
      graph.blockingErrors.map((blockingError) => ({
        id: blockingError.id,
        configurationId: blockingError.configurationId,
        description: translate(blockingError.description),
      })),
    );
  };

  beforeEach(() => {
    repository = {
      findLessonContext: jest.fn(),
      getConfigurationGraph: jest.fn(),
      getConfigurationInLanguage: jest.fn(),
      getCriteriaInLanguage: jest.fn(),
      getScoreGuidanceInLanguage: jest.fn(),
      getBlockingErrorsInLanguage: jest.fn(),
      updateTaskGoalTranslation: jest.fn(),
      updateCriterionTranslation: jest.fn(),
      updateScoreGuidanceTranslation: jest.fn(),
      updateBlockingErrorTranslation: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationRepository>;
    graphService = {
      createConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationGraphService>;

    const transactionDb = {
      transaction: jest.fn(async (callback: (trx: DatabasePg) => unknown) =>
        callback(transactionDb),
      ),
    } as unknown as DatabasePg;
    db = transactionDb;

    adminLessonService = {
      validateAccess: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AdminLessonService>;
    masterCourseService = {
      assertCourseContentEditableByLessonId: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MasterCourseService>;
    courseFeaturePolicyService = {
      assertCourseFeatureEnabledByLessonId: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CourseFeaturePolicyService>;

    repository.findLessonContext.mockResolvedValue(context);

    service = new AiJudgeConfigurationService(
      db,
      repository,
      graphService,
      adminLessonService,
      masterCourseService,
      courseFeaturePolicyService,
    );
  });

  it("returns empty values for missing requested translations in the admin editor", async () => {
    mockLocalizedGraph(
      {
        configuration: {
          id: configurationId,
          aiMentorLessonId,
          taskGoal: { en: "Explain the choice", pl: "Wyjaśnij wybór" },
          passingThresholdPercent: 70,
          tenantId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        criteria: [
          {
            id: criterionId,
            configurationId,
            maxScore: 5,
            title: { en: "Contact selection", pl: "Dobór kontaktów" },
            expectedBehavior: { en: "Select three suitable contacts" },
            tenantId,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        scoreGuidance: [
          {
            id: guidanceId,
            criterionId,
            score: 5,
            description: { en: "Fully meets the criterion", pl: "Pełne spełnienie" },
            example: null,
            tenantId,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        blockingErrors: [
          {
            id: blockingErrorId,
            configurationId,
            description: { en: "Invents facts", pl: "Zmyśla fakty" },
            tenantId,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
      SUPPORTED_LANGUAGES.PL,
    );

    const result = await service.getConfiguration(lessonId, currentUser, SUPPORTED_LANGUAGES.PL);

    expect(result).toMatchObject({
      language: SUPPORTED_LANGUAGES.PL,
      taskGoal: "Wyjaśnij wybór",
      totalMaxScore: 5,
      criteria: [
        {
          title: "Dobór kontaktów",
          expectedBehavior: "",
          scoreGuidance: [{ description: "Pełne spełnienie" }],
        },
      ],
      blockingErrors: [{ description: "Zmyśla fakty" }],
    });
  });

  it("updates an existing configuration using the derived base language", async () => {
    graphService.updateConfiguration.mockResolvedValue(configurationId);
    mockLocalizedGraph({
      configuration: {
        id: configurationId,
        aiMentorLessonId,
        taskGoal: { en: input.taskGoal },
        passingThresholdPercent: 70,
        tenantId,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      criteria: [],
      scoreGuidance: [],
      blockingErrors: [],
    });

    await service.replaceConfiguration(lessonId, input, currentUser);

    expect(graphService.updateConfiguration).toHaveBeenCalledWith(
      configurationId,
      input,
      SUPPORTED_LANGUAGES.EN,
    );
    expect(masterCourseService.assertCourseContentEditableByLessonId).toHaveBeenCalledWith(
      lessonId,
    );
    expect(courseFeaturePolicyService.assertCourseFeatureEnabledByLessonId).toHaveBeenCalledWith(
      lessonId,
      COURSE_FEATURE.CURRICULUM_EDITING,
    );
    expect(adminLessonService.validateAccess).toHaveBeenCalledWith(
      ENTITY_TYPES.LESSON,
      currentUser,
      lessonId,
    );
  });

  it("creates a configuration when the lesson has no Judge graph", async () => {
    repository.findLessonContext.mockResolvedValue({ ...context, configurationId: null });
    graphService.createConfiguration.mockResolvedValue(configurationId);
    mockLocalizedGraph({
      configuration: {
        id: configurationId,
        aiMentorLessonId,
        taskGoal: { en: input.taskGoal },
        passingThresholdPercent: 70,
        tenantId,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      criteria: [],
      scoreGuidance: [],
      blockingErrors: [],
    });

    await service.replaceConfiguration(lessonId, input, currentUser);

    expect(graphService.createConfiguration).toHaveBeenCalledWith(
      aiMentorLessonId,
      input,
      SUPPORTED_LANGUAGES.EN,
    );
    expect(graphService.updateConfiguration).not.toHaveBeenCalled();
  });

  it("rejects translation writes for the base language", async () => {
    await expect(
      service.updateTranslations(
        lessonId,
        SUPPORTED_LANGUAGES.EN,
        { taskGoal: "Base edit" },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repository.updateTaskGoalTranslation).not.toHaveBeenCalled();
  });

  it("rejects translation writes for a language unavailable in the course", async () => {
    await expect(
      service.updateTranslations(
        lessonId,
        SUPPORTED_LANGUAGES.DE,
        { taskGoal: "Nicht verfügbar" },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("keeps structure out of the translation contract", () => {
    expect(
      Value.Check(updateAiJudgeConfigurationTranslationSchema, {
        criteria: [{ id: criterionId, title: "Polski tytuł", maxScore: 5 }],
      }),
    ).toBe(false);
  });

  it("does not accept a language override in the canonical aggregate", () => {
    expect(Value.Check(aiJudgeConfigurationInputSchema, { ...input, language: "pl" })).toBe(false);
  });

  it("accepts a canonical aggregate without scoring criteria", () => {
    expect(Value.Check(aiJudgeConfigurationInputSchema, { ...input, criteria: [] })).toBe(true);
  });

  it("rejects a criterion maximum score above five", () => {
    expect(
      Value.Check(aiJudgeConfigurationInputSchema, {
        ...input,
        criteria: [
          {
            ...input.criteria[0],
            maxScore: 6,
            scoreGuidance: createGuidance(6),
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects a criterion without score guidance", () => {
    expect(
      Value.Check(aiJudgeConfigurationInputSchema, {
        ...input,
        criteria: [{ ...input.criteria[0], scoreGuidance: [] }],
      }),
    ).toBe(false);
  });
});
