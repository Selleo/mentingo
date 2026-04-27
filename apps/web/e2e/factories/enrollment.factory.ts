import type { FixtureApiClient } from "../utils/api-client";
import type {
  EnrollGroupsToCourseBody,
  GetGroupsByCourseResponse,
  GetStudentsWithEnrollmentDateResponse,
} from "~/api/generated-api";

export type EnrolledUserRecord = GetStudentsWithEnrollmentDateResponse["data"][number];
export type EnrolledGroupRecord = GetGroupsByCourseResponse["data"][number];
export type EnrollmentUsersQuery = {
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

export class EnrollmentFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async getUsers(courseId: string, query: EnrollmentUsersQuery = {}) {
    const response = await this.apiClient.api.courseControllerGetStudentsWithEnrollmentDate(
      courseId,
      query,
    );

    return response.data.data;
  }

  async getUser(courseId: string, userId: string) {
    let page = 1;
    let totalItems = 0;

    do {
      // TODO: Replace this pagination scan with backend-side filtering by user id when available.
      const response = await this.apiClient.api.courseControllerGetStudentsWithEnrollmentDate(
        courseId,
        { page, perPage: 100 },
      );
      const user = response.data.data.find((item) => item.id === userId);

      if (user) return user;

      totalItems = response.data.pagination.totalItems;
      page += 1;
    } while ((page - 1) * 100 < totalItems);

    return null;
  }

  async getGroups(courseId: string) {
    const response = await this.apiClient.api.groupControllerGetGroupsByCourse(courseId);

    return response.data.data;
  }

  async enrollUsers(courseId: string, userIds: string[]) {
    await this.apiClient.api.courseControllerEnrollCourses(courseId, { studentIds: userIds });
  }

  async unenrollUsers(courseId: string, userIds: string[]) {
    await this.apiClient.api.courseControllerUnenrollCourses({ courseId, userIds });
  }

  async enrollGroups(courseId: string, groups: EnrollGroupsToCourseBody["groups"]) {
    await this.apiClient.api.courseControllerEnrollGroupsToCourse(courseId, { groups });
  }

  async unenrollGroups(courseId: string, groupIds: string[]) {
    await this.apiClient.api.courseControllerUnenrollGroupsFromCourse(courseId, { groupIds });
  }

  async selfEnroll(courseId: string) {
    await this.apiClient.api.courseControllerEnrollCourse({ id: courseId });
  }

  async getCurrentUserId() {
    const response = await this.apiClient.api.authControllerCurrentUser();

    return response.data.data.id;
  }
}
