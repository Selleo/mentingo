import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AUDIT_DEFINITIONS, AUDIT_TYPES } from "@repo/shared";

import { AuditService } from "./audit.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const currentUser: CurrentUserType = {
  userId: "91f378d3-8021-4269-881d-4d896ee61d66",
  tenantId: "242359db-654d-4af2-93ee-71ac0ddb4d9f",
  email: "auditor@example.com",
  roleSlugs: [],
  permissions: [],
};

describe("AuditService", () => {
  const createService = () => {
    const repository = {
      create: jest.fn().mockImplementation((submission) => Promise.resolve(submission)),
      findLatestIndividual: jest.fn(),
      findLatestSchool: jest.fn(),
      findHistory: jest.fn(),
      findById: jest.fn(),
      findBenchmarkSubmissions: jest.fn(),
    };

    return {
      repository,
      service: new AuditService(repository as never),
    };
  };

  it("calculates the individual score from the server-owned definition", async () => {
    const { repository, service } = createService();
    const definition = AUDIT_DEFINITIONS[AUDIT_TYPES.INDIVIDUAL];
    const answers = definition.questions.map((question) => ({
      questionId: question.id,
      optionId: "level_4",
    }));

    await service.submit(
      AUDIT_TYPES.INDIVIDUAL,
      {
        definitionVersion: definition.version,
        answers,
      },
      currentUser,
    );

    expect(repository.create).toHaveBeenCalledWith({
      type: AUDIT_TYPES.INDIVIDUAL,
      definitionVersion: definition.version,
      submittedById: currentUser.userId,
      answers,
      score: 75,
      competencyScores: {
        ai_awareness: 75,
        curriculum_integration: 75,
        data_privacy: 75,
        ethical_understanding: 75,
        tool_proficiency: 75,
      },
    });
  });

  it("rejects a submission created from an outdated definition", () => {
    const { service } = createService();

    expect(() =>
      service.submit(AUDIT_TYPES.SCHOOL, { definitionVersion: 0, answers: [] }, currentUser),
    ).toThrow(new BadRequestException("auditView.errors.definitionOutdated"));
  });

  it("rejects missing, unknown, and duplicate answers", () => {
    const { service } = createService();
    const definition = AUDIT_DEFINITIONS[AUDIT_TYPES.SCHOOL];
    const validAnswers = definition.questions.map((question) => ({
      questionId: question.id,
      optionId: "level_3",
    }));

    const invalidAnswers = [
      [],
      validAnswers.map((answer, index) =>
        index === 0 ? { ...answer, optionId: "unknown" } : answer,
      ),
      [...validAnswers.slice(1), validAnswers[1] ?? validAnswers[0]],
    ];

    for (const answers of invalidAnswers) {
      expect(() =>
        service.submit(
          AUDIT_TYPES.SCHOOL,
          { definitionVersion: definition.version, answers },
          currentUser,
        ),
      ).toThrow(new BadRequestException("auditView.errors.invalidAnswers"));
    }
  });

  it("uses user scope for individual results and tenant scope for school results", () => {
    const { repository, service } = createService();

    service.getLatest(AUDIT_TYPES.INDIVIDUAL, currentUser);
    service.getLatest(AUDIT_TYPES.SCHOOL, currentUser);

    expect(repository.findLatestIndividual).toHaveBeenCalledWith(currentUser.userId);
    expect(repository.findLatestSchool).toHaveBeenCalledWith();
  });

  it("uses the same scopes for audit history and individual result details", async () => {
    const { repository, service } = createService();
    repository.findById.mockResolvedValue({ id: "submission-id" });

    service.getHistory(AUDIT_TYPES.INDIVIDUAL, currentUser);
    service.getHistory(AUDIT_TYPES.SCHOOL, currentUser);
    await service.getSubmission(
      AUDIT_TYPES.INDIVIDUAL,
      "00f83bc0-e7af-4435-af32-3be861ffd7f0",
      currentUser,
    );

    expect(repository.findHistory).toHaveBeenNthCalledWith(
      1,
      AUDIT_TYPES.INDIVIDUAL,
      currentUser.userId,
    );
    expect(repository.findHistory).toHaveBeenNthCalledWith(2, AUDIT_TYPES.SCHOOL, undefined);
    expect(repository.findById).toHaveBeenCalledWith(
      AUDIT_TYPES.INDIVIDUAL,
      "00f83bc0-e7af-4435-af32-3be861ffd7f0",
      currentUser.userId,
    );
  });

  it("returns not found when an audit is outside the user's allowed scope", async () => {
    const { repository, service } = createService();
    repository.findById.mockResolvedValue(null);

    await expect(
      service.getSubmission(
        AUDIT_TYPES.SCHOOL,
        "00f83bc0-e7af-4435-af32-3be861ffd7f0",
        currentUser,
      ),
    ).rejects.toThrow(new NotFoundException("auditView.errors.submissionNotFound"));
  });
});
