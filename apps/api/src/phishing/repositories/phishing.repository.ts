import { Inject, Injectable } from "@nestjs/common";
import { COURSE_STATUSES, PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { and, countDistinct, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { getGroupManagerGroupScopeCondition } from "src/common/permissions/group-manager-scope.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { courses, groups, groupUsers, studentCourses, users } from "src/storage/schema";

import { PHISHING_OPTION_PAGE_SIZE } from "../constants/phishing.constants";

import type { PhishingAudience, PhishingOptionQuery } from "../schemas/phishing.schema";
import type { PgSelect } from "drizzle-orm/pg-core";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class PhishingRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  findActiveUserOptions() {
    return this.db
      .select({ id: users.id, label: this.userOptionLabel() })
      .from(users)
      .where(this.activeUserCondition())
      .orderBy(users.lastName);
  }

  findAllGroupOptions(language: SupportedLanguages) {
    return this.db
      .select({
        id: groups.id,
        label: this.localizationService.getLocalizedSqlField(groups.name, language, groups),
      })
      .from(groups);
  }

  findAllEnrollableCourseOptions(language: SupportedLanguages) {
    return this.db
      .select({
        id: courses.id,
        label: this.localizationService.getLocalizedSqlField(courses.title, language),
      })
      .from(courses)
      .where(this.enrollableCourseCondition());
  }

  findGroupMemberships() {
    return this.db
      .select({ groupId: groupUsers.groupId, userId: groupUsers.userId })
      .from(groupUsers);
  }

  findUserOptions({ search, page }: PhishingOptionQuery) {
    const query = this.db
      .select({ id: users.id, label: this.userOptionLabel() })
      .from(users)
      .where(
        and(
          this.activeUserCondition(),
          search ? sql`${this.userOptionLabel()} ilike ${`%${search}%`}` : undefined,
        ),
      )
      .orderBy(users.lastName, users.firstName, users.id)
      .$dynamic();

    return this.limitToOptionPage(query, page);
  }

  findGroupOptions({ language, search, page }: PhishingOptionQuery) {
    const label = this.localizationService.getLocalizedSqlField(groups.name, language, groups);

    const query = this.db
      .select({ id: groups.id, label })
      .from(groups)
      .where(
        search
          ? this.localizationService.getLocalizedFieldSearchCondition(
              groups.name,
              `%${search}%`,
              language,
              { baseTable: groups, fallbackToBaseLanguage: true },
            )
          : undefined,
      )
      .orderBy(label, groups.id)
      .$dynamic();

    return this.limitToOptionPage(query, page);
  }

  findCourseOptions({ language, search, page }: PhishingOptionQuery) {
    const label = this.localizationService.getLocalizedSqlField(courses.title, language, courses);

    const query = this.db
      .select({ id: courses.id, label })
      .from(courses)
      .where(
        and(
          this.enrollableCourseCondition(),
          search
            ? this.localizationService.getLocalizedFieldSearchCondition(
                courses.title,
                `%${search}%`,
                language,
                { baseTable: courses, fallbackToBaseLanguage: true },
              )
            : undefined,
        ),
      )
      .orderBy(label, courses.id)
      .$dynamic();

    return this.limitToOptionPage(query, page);
  }

  async countAudience({ userIds, groupIds }: PhishingAudience) {
    const [audience] = await this.db
      .select({ count: countDistinct(users.id) })
      .from(users)
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .where(
        and(
          this.activeUserCondition(),
          or(inArray(users.id, userIds), inArray(groupUsers.groupId, groupIds)),
        ),
      );

    return audience;
  }

  async findEnrollableCourse(id: string) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, id), this.enrollableCourseCondition()));

    return course;
  }

  async findActiveUser(id: string) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, firstName: users.firstName })
      .from(users)
      .where(and(eq(users.id, id), this.activeUserCondition()));

    return user;
  }

  findTenantOrigin(tenantId: string) {
    return resolveTenantOrigin(this.db, tenantId);
  }

  async findEnrollableCourseTitle(id: string, language: SupportedLanguages) {
    const [course] = await this.db
      .select({
        title: this.localizationService.getLocalizedSqlField(courses.title, language, courses),
      })
      .from(courses)
      .where(and(eq(courses.id, id), this.enrollableCourseCondition()));

    return course?.title;
  }

  async findGroupMemberUserIds(groupIds: string[]) {
    if (!groupIds.length) return [];

    const members = await this.db
      .select({ userId: groupUsers.userId })
      .from(groupUsers)
      .where(inArray(groupUsers.groupId, groupIds));

    return members.map(({ userId }) => userId);
  }

  async findActiveRecipients(userIds: string[]) {
    if (!userIds.length) return [];

    return this.db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(and(inArray(users.id, userIds), this.activeUserCondition()));
  }

  async findGroupMembershipsOfUsers(userIds: string[]) {
    if (!userIds.length) return [];

    return this.db
      .select({ userId: groupUsers.userId, groupId: groupUsers.groupId })
      .from(groupUsers)
      .where(inArray(groupUsers.userId, userIds));
  }

  async findReportGroups(actor: CurrentUserType, language: SupportedLanguages) {
    return this.db
      .select({
        id: groups.id,
        name: this.localizationService.getLocalizedSqlField(groups.name, language, groups),
      })
      .from(groups)
      .where(getGroupManagerGroupScopeCondition(actor, groups.id, [PERMISSIONS.PHISHING_MANAGE]));
  }

  async findEnrollments(courseId: string, userIds: string[]) {
    if (!userIds.length) return [];

    return this.db
      .select({
        userId: studentCourses.studentId,
        status: studentCourses.status,
        progress: studentCourses.progress,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, userIds)),
      );
  }

  /** Serializes concurrent risky-action webhooks for one recipient until the transaction ends. */
  async lockRecipientEnrollment(tenantId: string, courseId: string, userId: string) {
    await this.db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${courseId}:${userId}`},0))`,
    );
  }

  private userOptionLabel() {
    return sql<string>`${users.firstName} || ' ' || ${users.lastName} || ' (' || ${users.email} || ')'`;
  }

  private activeUserCondition() {
    return and(isNull(users.deletedAt), eq(users.archived, false));
  }

  private enrollableCourseCondition() {
    return and(ne(courses.status, COURSE_STATUSES.DRAFT), eq(courses.priceInCents, 0));
  }

  /** Fetches one row beyond the page so the caller can tell whether a next page exists. */
  private limitToOptionPage<T extends PgSelect>(query: T, page: number) {
    return query
      .limit(PHISHING_OPTION_PAGE_SIZE + 1)
      .offset((page - 1) * PHISHING_OPTION_PAGE_SIZE);
  }
}
