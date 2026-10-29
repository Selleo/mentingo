import { Injectable } from "@nestjs/common";

import { CourseBulkEditingService } from "./authoring/course-bulk-editing.service";
import { CourseDeletionService } from "./authoring/course-deletion.service";
import { CourseEditingService } from "./authoring/course-editing.service";
import { CourseCatalogService } from "./catalog/course-catalog.service";
import { CourseLearnerDashboardService } from "./dashboard/course-learner-dashboard.service";
import { CourseDueDateNotificationService } from "./due-dates/course-due-date-notification.service";
import { CourseEnrollmentService } from "./enrollment/course-enrollment.service";
import { CourseTranslationService } from "./languages/course-translation.service";
import { CourseStudentModeService } from "./learning-mode/course-student-mode.service";
import { CourseDetailService } from "./overview/course-detail.service";
import { CourseAuthorService } from "./ownership/course-author.service";
import { CourseStatisticsService } from "./statistics/course-statistics.service";

import type { CourseReadOptions } from "./course.types";
import type { BulkArchiveCourseBody } from "./schemas/bulkArchiveCourse.schema";
import type { BulkUpdateCourseCategoryBody } from "./schemas/bulkUpdateCourseCategory.schema";
import type { BulkUpdateCourseStatusBody } from "./schemas/bulkUpdateCourseStatus.schema";
import type {
  AllCoursesForContentCreatorResponse,
  AllCoursesResponse,
  AllStudentCoursesResponse,
  PublishedCourseLookupResponse,
  CourseAverageQuizScoresResponse,
  CourseStatisticsQueryBody,
  CourseStatisticsResponse,
  EnrolledCourseGroupsPayload,
  LessonSequenceEnabledResponse,
  TransferCourseOwnershipRequestBody,
} from "./schemas/course.schema";
import type { CourseLookupResponse } from "./schemas/courseLookupResponse.schema";
import type {
  CoursesQuery,
  CourseStudentAiMentorResultsQuery,
  CourseStudentProgressionQuery,
  CourseStudentQuizResultsQuery,
  EnrolledStudentsQuery,
} from "./schemas/courseQuery";
import type { CreateCourseBody } from "./schemas/createCourse.schema";
import type { CreateCoursesEnrollment } from "./schemas/createCoursesEnrollment";
import type { StudentCourseSelect } from "./schemas/enrolledStudent.schema";
import type { CommonShowBetaCourse, CommonShowCourse } from "./schemas/showCourseCommon.schema";
import type { StudentCourseDashboardSummary } from "./schemas/studentDashboard.schema";
import type { UpdateCourseBody } from "./schemas/updateCourse.schema";
import type { UpdateCourseMediaBody } from "./schemas/updateCourseMedia.schema";
import type { UpdateCourseSettings } from "./schemas/updateCourseSettings.schema";
import type { CoursesSettings } from "./types/settings";
import type { PermissionKey, SupportedLanguages } from "@repo/shared";
import type { AllCategoriesResponse } from "src/category/schemas/category.schema";
import type { DatabasePg, Pagination, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseService {
  constructor(
    private readonly courseDueDateNotificationService: CourseDueDateNotificationService,
    private readonly courseTranslationService: CourseTranslationService,
    private readonly courseAuthorService: CourseAuthorService,
    private readonly courseStudentModeService: CourseStudentModeService,
    private readonly courseStatisticsService: CourseStatisticsService,
    private readonly courseEnrollmentService: CourseEnrollmentService,
    private readonly courseEditingService: CourseEditingService,
    private readonly courseBulkEditingService: CourseBulkEditingService,
    private readonly courseDeletionService: CourseDeletionService,
    private readonly courseCatalogService: CourseCatalogService,
    private readonly courseDetailService: CourseDetailService,
    private readonly courseLearnerDashboardService: CourseLearnerDashboardService,
  ) {}

  async getAllCourses(query: CoursesQuery): Promise<{
    data: AllCoursesResponse;
    pagination: Pagination;
  }> {
    return this.courseCatalogService.getAllCourses(query);
  }

  async getCoursesForUser(
    query: CoursesQuery,
    userId: UUIDType,
  ): Promise<{ data: AllStudentCoursesResponse; pagination: Pagination }> {
    return this.courseCatalogService.getCoursesForUser(query, userId);
  }

  async markCourseOpened(courseId: UUIDType, userId: UUIDType): Promise<void> {
    return this.courseLearnerDashboardService.markCourseOpened(courseId, userId);
  }

  async getStudentDashboardSummary(
    userId: UUIDType,
    language: SupportedLanguages,
  ): Promise<StudentCourseDashboardSummary> {
    return this.courseLearnerDashboardService.getStudentDashboardSummary(userId, language);
  }

  async getStudentsWithEnrollmentDate(query: EnrolledStudentsQuery) {
    return this.courseEnrollmentService.getStudentsWithEnrollmentDate(query);
  }

  async getCourseSequenceEnabled(courseId: UUIDType): Promise<LessonSequenceEnabledResponse> {
    return this.courseEditingService.getCourseSequenceEnabled(courseId);
  }

  async getAvailableCourses(
    query: CoursesQuery,
    currentUserId?: UUIDType,
  ): Promise<{ data: AllStudentCoursesResponse; pagination: Pagination }> {
    return this.courseCatalogService.getAvailableCourses(query, currentUserId);
  }

  async getAvailableCourseCategories(
    query: CoursesQuery,
    currentUserId?: UUIDType,
  ): Promise<{ data: AllCategoriesResponse; pagination: Pagination }> {
    return this.courseCatalogService.getAvailableCourseCategories(query, currentUserId);
  }

  async getTopCourses(
    query: { limit?: number; days?: number; language: SupportedLanguages },
    currentUserId?: UUIDType,
  ): Promise<AllStudentCoursesResponse> {
    return this.courseCatalogService.getTopCourses(query, currentUserId);
  }

  async getPublishedCourseLookup(query: {
    title?: string;
    page?: number;
    perPage?: number;
    language: SupportedLanguages;
  }): Promise<{ data: PublishedCourseLookupResponse; pagination: Pagination }> {
    return this.courseCatalogService.getPublishedCourseLookup(query);
  }

  async getCourse(
    idOrSlug: UUIDType | string,
    currentUser: CurrentUserType | undefined,
    language: SupportedLanguages,
    options: CourseReadOptions = {},
  ): Promise<CommonShowCourse> {
    return this.courseDetailService.getCourse(idOrSlug, currentUser, language, options);
  }

  async lookupCourse(
    idOrSlug: string,
    language: SupportedLanguages,
    userId?: UUIDType,
    userPermissions: PermissionKey[] = [],
  ): Promise<CourseLookupResponse> {
    return this.courseDetailService.lookupCourse(idOrSlug, language, userId, userPermissions);
  }

  async getBetaCourseById(
    id: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<CommonShowBetaCourse> {
    return this.courseDetailService.getBetaCourseById(id, language, currentUser);
  }

  async getContentCreatorCourses(
    params: Parameters<CourseCatalogService["getContentCreatorCourses"]>[0],
  ): Promise<AllCoursesForContentCreatorResponse> {
    return this.courseCatalogService.getContentCreatorCourses(params);
  }

  async updateHasCertificate(
    courseId: UUIDType,
    hasCertificate: boolean,
    currentUser: CurrentUserType,
  ) {
    return this.courseEditingService.updateHasCertificate(courseId, hasCertificate, currentUser);
  }

  async updateCourseSettings(
    courseId: UUIDType,
    settings: UpdateCourseSettings,
    currentUser: CurrentUserType,
    certificateSignature?: Express.Multer.File | null,
    preparedCertificateSignatureReference?: string,
  ) {
    return this.courseEditingService.updateCourseSettings(
      courseId,
      settings,
      currentUser,
      certificateSignature,
      preparedCertificateSignatureReference,
    );
  }

  async getCourseSettings(
    courseId: UUIDType,
  ): Promise<CoursesSettings & { certificateSignatureUrl: string | null }> {
    return this.courseEditingService.getCourseSettings(courseId);
  }

  async createCourse(
    createCourseBody: CreateCourseBody,
    currentUser: CurrentUserType,
    isPlaywrightTest: boolean,
  ) {
    return this.courseEditingService.createCourse(createCourseBody, currentUser, isPlaywrightTest);
  }

  async createCourseInTransaction(
    createCourseBody: CreateCourseBody,
    currentUser: CurrentUserType,
    isPlaywrightTest: boolean,
    dbInstance: DatabasePg,
  ) {
    return this.courseEditingService.createCourseInTransaction(
      createCourseBody,
      currentUser,
      isPlaywrightTest,
      dbInstance,
    );
  }

  async publishCreateCourseEvent(
    courseId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    return this.courseEditingService.publishCreateCourseEvent(courseId, language, currentUser);
  }

  async updateCourseMedia(
    id: UUIDType,
    updateCourseMediaBody: UpdateCourseMediaBody,
    currentUser: CurrentUserType,
    image?: Express.Multer.File,
  ) {
    return this.courseEditingService.updateCourseMedia(
      id,
      updateCourseMediaBody,
      currentUser,
      image,
    );
  }

  async updateCourse(
    id: UUIDType,
    updateCourseBody: UpdateCourseBody,
    currentUser: CurrentUserType,
    isPlaywrightTest: boolean,
  ) {
    return this.courseEditingService.updateCourse(
      id,
      updateCourseBody,
      currentUser,
      isPlaywrightTest,
    );
  }

  async bulkUpdateCourseStatus(
    body: BulkUpdateCourseStatusBody,
    currentUser: CurrentUserType,
  ): Promise<void> {
    return this.courseBulkEditingService.bulkUpdateCourseStatus(body, currentUser);
  }

  async bulkArchiveCourse(body: BulkArchiveCourseBody, currentUser: CurrentUserType) {
    return this.courseBulkEditingService.bulkArchiveCourse(body, currentUser);
  }

  async bulkUpdateCourseCategory(
    body: BulkUpdateCourseCategoryBody,
    currentUser: CurrentUserType,
  ): Promise<void> {
    return this.courseBulkEditingService.bulkUpdateCourseCategory(body, currentUser);
  }

  async deleteCourseTrailer(courseId: UUIDType, currentUser: CurrentUserType) {
    return this.courseEditingService.deleteCourseTrailer(courseId, currentUser);
  }

  async enrollCourse(
    id: UUIDType,
    studentId: UUIDType,
    testKey?: string,
    paymentId?: string,
    currentUser?: CurrentUserType,
  ) {
    return this.courseEnrollmentService.enrollCourse(
      id,
      studentId,
      testKey,
      paymentId,
      currentUser,
    );
  }

  async enrollCourses(
    courseId: UUIDType,
    body: CreateCoursesEnrollment,
    currentUser: CurrentUserType,
  ) {
    return this.courseEnrollmentService.enrollCourses(courseId, body, currentUser);
  }

  async enrollGroupsToCourse(
    courseId: UUIDType,
    groupsToEnroll: EnrolledCourseGroupsPayload["groups"],
    currentUser?: CurrentUserType,
  ) {
    return this.courseEnrollmentService.enrollGroupsToCourse(courseId, groupsToEnroll, currentUser);
  }

  async unenrollGroupsFromCourse(courseId: UUIDType, groupIds: UUIDType[]) {
    return this.courseEnrollmentService.unenrollGroupsFromCourse(courseId, groupIds);
  }

  async unenrollCourse(courseId: UUIDType, userIds: UUIDType[]) {
    return this.courseEnrollmentService.unenrollCourse(courseId, userIds);
  }

  async getStudentCourseEnrollments(
    studentId: UUIDType,
    courseIds: UUIDType[],
    dbInstance?: DatabasePg,
  ) {
    return this.courseEnrollmentService.getStudentCourseEnrollments(
      studentId,
      courseIds,
      dbInstance,
    );
  }

  async activateStudentCourseEnrollment(
    courseId: UUIDType,
    studentId: UUIDType,
    dbInstance?: DatabasePg,
  ) {
    return this.courseEnrollmentService.activateStudentCourseEnrollment(
      courseId,
      studentId,
      dbInstance,
    );
  }

  async markStudentCoursesNotEnrolled(
    studentId: UUIDType,
    courseIds: UUIDType[],
    dbInstance?: DatabasePg,
  ) {
    return this.courseEnrollmentService.markStudentCoursesNotEnrolled(
      studentId,
      courseIds,
      dbInstance,
    );
  }

  async createStudentCourse(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
    enrolledByGroupId: UUIDType | null = null,
    dbInstance?: DatabasePg,
  ): Promise<StudentCourseSelect> {
    return this.courseEnrollmentService.createStudentCourse(
      courseId,
      studentId,
      paymentId,
      enrolledByGroupId,
      dbInstance,
    );
  }

  async createCourseDependencies(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
    trx?: DatabasePg,
  ) {
    return this.courseEnrollmentService.createCourseDependencies(
      courseId,
      studentId,
      paymentId,
      trx,
    );
  }

  async setCourseStudentMode(
    courseId: UUIDType,
    currentUser: CurrentUserType,
    enableStudentMode: boolean,
  ) {
    return this.courseStudentModeService.setCourseStudentMode(
      courseId,
      currentUser,
      enableStudentMode,
    );
  }

  async getStudentModeCourseIds(userId: UUIDType, dbInstance?: DatabasePg) {
    return this.courseStudentModeService.getStudentModeCourseIds(userId, dbInstance);
  }

  async isCourseStudentModeEnabled(courseId: UUIDType, userId: UUIDType, dbInstance?: DatabasePg) {
    return this.courseStudentModeService.isCourseStudentModeEnabled(courseId, userId, dbInstance);
  }

  async deleteCourse(id: UUIDType, currentUser: CurrentUserType) {
    return this.courseDeletionService.deleteCourse(id, currentUser);
  }

  async deleteManyCourses(ids: UUIDType[], currentUser: CurrentUserType) {
    return this.courseDeletionService.deleteManyCourses(ids, currentUser);
  }

  async getCourseStatistics(
    id: UUIDType,
    query: CourseStatisticsQueryBody,
    currentUser: CurrentUserType,
  ): Promise<CourseStatisticsResponse> {
    return this.courseStatisticsService.getCourseStatistics(id, query, currentUser);
  }

  async assertCanViewCourseStatistics(
    courseId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<void> {
    return this.courseStatisticsService.assertCanViewCourseStatistics(courseId, currentUser);
  }

  async getAverageQuizScoreForCourse(
    courseId: UUIDType,
    query: CourseStatisticsQueryBody,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<CourseAverageQuizScoresResponse> {
    return this.courseStatisticsService.getAverageQuizScoreForCourse(
      courseId,
      query,
      language,
      currentUser,
    );
  }

  async getStudentsProgress(query: CourseStudentProgressionQuery, currentUser: CurrentUserType) {
    return this.courseStatisticsService.getStudentsProgress(query, currentUser);
  }

  async getStudentsQuizResults(query: CourseStudentQuizResultsQuery, currentUser: CurrentUserType) {
    return this.courseStatisticsService.getStudentsQuizResults(query, currentUser);
  }

  async getStudentsAiMentorResults(
    query: CourseStudentAiMentorResultsQuery,
    currentUser: CurrentUserType,
  ) {
    return this.courseStatisticsService.getStudentsAiMentorResults(query, currentUser);
  }

  async getCourseEmailData(courseId: UUIDType, language?: SupportedLanguages) {
    return this.courseDetailService.getCourseEmailData(courseId, language);
  }

  async getChapterName(chapterId: UUIDType, language?: SupportedLanguages) {
    return this.courseDetailService.getChapterName(chapterId, language);
  }

  async getStudentsWithoutCertificate(courseId: UUIDType) {
    return this.courseEnrollmentService.getStudentsWithoutCertificate(courseId);
  }

  async getStudentsDueDatesForCourse(courseId: UUIDType, studentIds: UUIDType[]) {
    return this.courseDueDateNotificationService.getStudentsDueDatesForCourse(courseId, studentIds);
  }

  async sendOverdueCoursesEmails() {
    return this.courseDueDateNotificationService.sendOverdueCoursesEmails();
  }

  async sendCourseDueDateReminders() {
    return this.courseDueDateNotificationService.sendCourseDueDateReminders();
  }

  async deleteLanguage(
    courseId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    return this.courseTranslationService.deleteLanguage(courseId, language, currentUser);
  }

  async getCourseOwnership(courseId: UUIDType) {
    return this.courseAuthorService.getCourseOwnership(courseId);
  }

  async transferCourseOwnership(data: TransferCourseOwnershipRequestBody) {
    return this.courseAuthorService.transferCourseOwnership(data);
  }

  async refreshAuthorMetadata(authorId: UUIDType): Promise<void> {
    return this.courseAuthorService.refreshAuthorMetadata(authorId);
  }
}
