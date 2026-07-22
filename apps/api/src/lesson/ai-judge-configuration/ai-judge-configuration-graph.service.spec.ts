import { BadRequestException } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { AiJudgeConfigurationGraphService } from "./ai-judge-configuration-graph.service";

import type { AiJudgeConfigurationRepository } from "./ai-judge-configuration.repository";
import type { AiJudgeConfigurationInput } from "./ai-judge-configuration.schema";
import type { DatabasePg, UUIDType } from "src/common";

const aiMentorLessonId = "00000000-0000-4000-8000-000000000001" as UUIDType;
const configurationId = "00000000-0000-4000-8000-000000000002" as UUIDType;
const criterionIds = [
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
] as UUIDType[];
const createGuidance = (maxScore: number) =>
  Array.from({ length: maxScore + 1 }, (_, score) => ({
    score,
    description: `Guidance for score ${score}`,
  }));

const validInput: AiJudgeConfigurationInput = {
  taskGoal: "Practice a sales conversation",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Discovery",
      expectedBehavior: "Asks relevant discovery questions",
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

describe("AiJudgeConfigurationGraphService", () => {
  let service: AiJudgeConfigurationGraphService;
  let repository: jest.Mocked<AiJudgeConfigurationRepository>;
  let db: DatabasePg;

  beforeEach(() => {
    db = {
      transaction: jest.fn((callback) => callback(db)),
    } as unknown as DatabasePg;
    repository = {
      getConfigurationGraph: jest.fn(),
      createConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      createCriterion: jest.fn(),
      updateCriterion: jest.fn(),
      deleteCriteria: jest.fn(),
      createScoreGuidance: jest.fn(),
      updateScoreGuidance: jest.fn(),
      stageScoreGuidanceScores: jest.fn(),
      deleteScoreGuidance: jest.fn(),
      createBlockingError: jest.fn(),
      updateBlockingError: jest.fn(),
      deleteBlockingErrors: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationRepository>;
    service = new AiJudgeConfigurationGraphService(db, repository);
  });

  it("creates a complete normalized graph in the supplied lesson transaction", async () => {
    repository.createConfiguration.mockResolvedValue({ id: configurationId } as never);
    repository.createCriterion
      .mockResolvedValueOnce({ id: criterionIds[0] } as never)
      .mockResolvedValueOnce({ id: criterionIds[1] } as never)
      .mockResolvedValueOnce({ id: criterionIds[2] } as never);

    await service.createConfigurationInTransaction(
      aiMentorLessonId,
      validInput,
      SUPPORTED_LANGUAGES.EN,
      db,
    );

    expect(repository.createConfiguration).toHaveBeenCalledWith(
      aiMentorLessonId,
      validInput,
      SUPPORTED_LANGUAGES.EN,
      db,
    );
    expect(repository.createCriterion).toHaveBeenCalledTimes(3);
    expect(repository.createScoreGuidance).toHaveBeenCalledWith(
      criterionIds[0],
      { score: 5, description: "Guidance for score 5" },
      SUPPORTED_LANGUAGES.EN,
      db,
    );
  });

  it("accepts a configuration without scoring criteria", async () => {
    repository.createConfiguration.mockResolvedValue({ id: configurationId } as never);

    await service.createConfigurationInTransaction(
      aiMentorLessonId,
      { ...validInput, criteria: [] },
      SUPPORTED_LANGUAGES.EN,
      db,
    );

    expect(repository.createConfiguration).toHaveBeenCalled();
    expect(repository.createCriterion).not.toHaveBeenCalled();
  });

  it("rejects duplicate or out-of-range exact guidance scores", async () => {
    const invalidCriterion = {
      ...validInput.criteria[0],
      scoreGuidance: [
        { score: 6, description: "Impossible" },
        { score: 6, description: "Duplicate" },
      ],
    };

    await expect(
      service.createConfigurationInTransaction(
        aiMentorLessonId,
        { ...validInput, criteria: [invalidCriterion, ...validInput.criteria.slice(1)] },
        SUPPORTED_LANGUAGES.EN,
        db,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects guidance that does not cover every score from zero through maxScore", async () => {
    const incompleteCriterion = {
      ...validInput.criteria[0],
      scoreGuidance: [
        { score: 0, description: "No evidence" },
        { score: 5, description: "Full evidence" },
      ],
    };

    await expect(
      service.createConfigurationInTransaction(
        aiMentorLessonId,
        { ...validInput, criteria: [incompleteCriterion] },
        SUPPORTED_LANGUAGES.EN,
        db,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repository.createConfiguration).not.toHaveBeenCalled();
  });

  it("rejects IDs that do not belong to the existing configuration", async () => {
    repository.getConfigurationGraph.mockResolvedValue({
      configuration: { id: configurationId } as never,
      criteria: [],
      scoreGuidance: [],
      blockingErrors: [],
    });

    await expect(
      service.updateConfiguration(
        configurationId,
        {
          ...validInput,
          criteria: [
            { ...validInput.criteria[0], id: criterionIds[0] },
            ...validInput.criteria.slice(1),
          ],
        },
        SUPPORTED_LANGUAGES.EN,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repository.updateConfiguration).not.toHaveBeenCalled();
  });

  it("rejects persisted child IDs on the explicit create path", async () => {
    await expect(
      service.createConfigurationInTransaction(
        aiMentorLessonId,
        {
          ...validInput,
          criteria: [
            { ...validInput.criteria[0], id: criterionIds[0] },
            ...validInput.criteria.slice(1),
          ],
        },
        SUPPORTED_LANGUAGES.EN,
        db,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repository.createConfiguration).not.toHaveBeenCalled();
  });
});
