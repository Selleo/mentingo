import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AUDIT_DEFINITIONS, AUDIT_TYPES, type AuditCompetency, type AuditType } from "@repo/shared";

import { buildAuditBenchmark } from "./audit-benchmark";
import { AuditRepository } from "./audit.repository";

import type { CreateAuditSubmissionBody } from "./audit.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  getLatest(type: AuditType, currentUser: CurrentUserType) {
    return type === AUDIT_TYPES.INDIVIDUAL
      ? this.auditRepository.findLatestIndividual(currentUser.userId)
      : this.auditRepository.findLatestSchool();
  }

  submit(type: AuditType, body: CreateAuditSubmissionBody, currentUser: CurrentUserType) {
    const definition = AUDIT_DEFINITIONS[type];
    if (body.definitionVersion !== definition.version) {
      throw new BadRequestException("auditView.errors.definitionOutdated");
    }

    const answersByQuestion = new Map(body.answers.map((answer) => [answer.questionId, answer]));
    if (
      body.answers.length !== definition.questions.length ||
      answersByQuestion.size !== definition.questions.length
    ) {
      throw new BadRequestException("auditView.errors.invalidAnswers");
    }

    const competencyValues = new Map<AuditCompetency, number[]>();
    const questionScores = definition.questions.map((question) => {
      const answer = answersByQuestion.get(question.id);
      const option = question.options.find((candidate) => candidate.id === answer?.optionId);
      if (!answer || !option) throw new BadRequestException("auditView.errors.invalidAnswers");

      competencyValues.set(question.competency, [
        ...(competencyValues.get(question.competency) ?? []),
        option.score,
      ]);
      return option.score;
    });
    const competencyScores = Object.fromEntries(
      [...competencyValues.entries()].map(([competency, scores]) => [
        competency,
        this.average(scores),
      ]),
    );

    return this.auditRepository.create({
      type,
      definitionVersion: definition.version,
      submittedById: currentUser.userId,
      answers: body.answers,
      score: this.average(questionScores),
      competencyScores,
    });
  }

  async getBenchmark(currentUser: CurrentUserType) {
    const submissions = await this.auditRepository.findBenchmarkSubmissions();
    return buildAuditBenchmark(submissions, currentUser.tenantId);
  }

  getHistory(type: AuditType, currentUser: CurrentUserType) {
    return this.auditRepository.findHistory(
      type,
      type === AUDIT_TYPES.INDIVIDUAL ? currentUser.userId : undefined,
    );
  }

  async getSubmission(type: AuditType, id: UUIDType, currentUser: CurrentUserType) {
    const submission = await this.auditRepository.findById(
      type,
      id,
      type === AUDIT_TYPES.INDIVIDUAL ? currentUser.userId : undefined,
    );
    if (!submission) throw new NotFoundException("auditView.errors.submissionNotFound");
    return submission;
  }

  private average(values: number[]) {
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }
}
