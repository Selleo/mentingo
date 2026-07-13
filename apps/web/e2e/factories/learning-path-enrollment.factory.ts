import type { FixtureApiClient } from "../utils/api-client";
import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";

export type LearningPathEnrolledUserRecord = GetStudentsWithEnrollmentDateResponse["data"][number];
export type LearningPathEnrollmentUsersQuery = {
  keyword?: string;
  sort?:
    | "enrolledAt"
    | "firstName"
    | "lastName"
    | "email"
    | "isEnrolledByGroup"
    | "-enrolledAt"
    | "-firstName"
    | "-lastName"
    | "-email"
    | "-isEnrolledByGroup";
  groups?: string[];
  page?: number;
  perPage?: number;
};

export class LearningPathEnrollmentFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async getUsers(learningPathId: string, query: LearningPathEnrollmentUsersQuery = {}) {
    const response =
      await this.apiClient.api.learningPathEnrollmentControllerGetStudentsWithEnrollmentDate(
        learningPathId,
        query,
      );

    return response.data.data;
  }

  async enrollUsers(learningPathId: string, userIds: string[]) {
    await this.apiClient.api.learningPathEnrollmentControllerEnrollUsersToLearningPath(
      learningPathId,
      { studentIds: userIds },
    );
  }

  async unenrollUsers(learningPathId: string, userIds: string[]) {
    await this.apiClient.api.learningPathEnrollmentControllerUnenrollUsersFromLearningPath(
      learningPathId,
      { studentIds: userIds },
    );
  }

  async enrollGroups(learningPathId: string, groupIds: string[]) {
    await this.apiClient.api.learningPathEnrollmentControllerEnrollGroupsToLearningPath(
      learningPathId,
      { groupIds },
    );
  }

  async unenrollGroups(learningPathId: string, groupIds: string[]) {
    await this.apiClient.api.learningPathEnrollmentControllerUnenrollGroupsFromLearningPath(
      learningPathId,
      { groupIds },
    );
  }

  async selfEnroll(learningPathId: string) {
    await this.apiClient.api.learningPathEnrollmentControllerEnrollCurrentUserToLearningPath(
      learningPathId,
    );
  }
}
