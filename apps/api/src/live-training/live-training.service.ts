import { randomUUID } from "node:crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CALENDAR_EVENT_STATUSES,
  DEFAULT_LIVE_TRAINING_SETTINGS,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
  LIVE_TRAINING_MEMBER_ROLES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  LIVE_TRAINING_STATUSES,
  LIVE_TRAINING_VISIBILITY_SCOPES,
  PERMISSIONS,
  type LiveTrainingResourceRelationshipType,
  type LiveTrainingSettings,
  type LiveTrainingVisibilityScope,
  type SupportedLanguages,
} from "@repo/shared";
import { and, eq, gt, isNull, lt } from "drizzle-orm";

import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";
import { FileService } from "src/file/file.service";
import { calendarEvents, liveTrainingLinks, liveTrainings } from "src/storage/schema";

import { LiveTrainingRepository } from "./live-training.repository";

import type {
  CalendarEventUpdateInput,
  LiveTrainingLinkInput,
  LiveTrainingListAppliedFilters,
  LiveTrainingTrainerInput,
  LiveTrainingUpdateInput,
  LiveTrainingVisibilityLinkedCourse,
  LiveTrainingVisibilityRow,
  LiveTrainingVisibilityTrainer,
} from "./live-training.types";
import type { CreateLiveTrainingBody } from "./schemas/create-live-training.schema";
import type { LiveTrainingDetails } from "./schemas/live-training-details.schema";
import type { LiveTrainingListQuery } from "./schemas/live-training-list-query.schema";
import type { LiveTrainingListItem } from "./schemas/live-training-list.schema";
import type { UpdateLiveTrainingBody } from "./schemas/update-live-training.schema";
import type { SQL } from "drizzle-orm";
import type { Pagination, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class LiveTrainingService {
  constructor(
    private readonly liveTrainingRepository: LiveTrainingRepository,
    private readonly fileService: FileService,
  ) {}

  async getLiveTrainings(
    query: LiveTrainingListQuery,
    currentUser: CurrentUserType,
  ): Promise<{
    data: LiveTrainingListItem[];
    pagination: Pagination;
    appliedFilters: LiveTrainingListAppliedFilters;
  }> {
    this.assertValidRangeFilters(query.start, query.end);

    const rows = await this.liveTrainingRepository.getLiveTrainingListRows(
      this.getListConditions(query),
      query.language,
    );

    const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
    const visibleItems: LiveTrainingListItem[] = [];

    for (const row of uniqueRows) {
      const [trainers, linkedCourses] = await Promise.all([
        this.liveTrainingRepository.getLiveTrainingTrainerRows(row.id),
        this.liveTrainingRepository.getLiveTrainingLinkedCourseRows(row.id, query.language),
      ]);

      if (!(await this.canSeeLiveTraining(row, trainers, linkedCourses, currentUser))) continue;

      visibleItems.push({
        id: row.id,
        calendarEventId: row.calendarEventId,
        title: row.title,
        description: row.description || null,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        timezone: row.timezone,
        location: row.location,
        deliveryType: row.deliveryType,
        visibilityScope: row.visibilityScope,
        status: row.status,
        maxParticipants: row.maxParticipants,
        authorId: row.authorId,
        trainerIds: trainers.map((trainer) => trainer.id),
        linkedCourseIds: linkedCourses.map((course) => course.id),
      });
    }

    const page = query.page ?? 1;
    const perPage = query.perPage ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * perPage;

    return {
      data: visibleItems.slice(offset, offset + perPage),
      pagination: {
        totalItems: visibleItems.length,
        page,
        perPage,
      },
      appliedFilters: {
        status: query.status,
        deliveryType: query.deliveryType,
        start: query.start,
        end: query.end,
        courseId: query.courseId,
        language: query.language,
      },
    };
  }

  async getLiveTraining(
    id: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingDetails> {
    return this.getLiveTrainingDetailsOrThrow(id, language, currentUser);
  }

  async createLiveTraining(
    body: CreateLiveTrainingBody,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingDetails> {
    this.assertValidSchedule(body.startsAt, body.endsAt);

    const linkedCourseIds = this.getUniqueIds(body.linkedCourseIds);
    const trainerUserIds = this.getCreateTrainerUserIds(currentUser.userId, body.trainerUserIds);
    const beforeResourceIds = this.getUniqueIds(body.beforeResourceIds);
    const afterResourceIds = this.getUniqueIds(body.afterResourceIds);
    const allResourceIds = this.uniqueIds([...beforeResourceIds, ...afterResourceIds]);
    const visibilityScope = this.deriveVisibilityScope(linkedCourseIds);
    const availableLocales = [language];
    const title = buildJsonbField(language, body.title);
    let description = null;

    if (!title) {
      throw new BadRequestException("liveTraining.errors.invalidLocalizedField");
    }

    if (body.description !== undefined && body.description !== null) {
      const localizedDescription = buildJsonbField(language, body.description);

      if (!localizedDescription) {
        throw new BadRequestException("liveTraining.errors.invalidLocalizedField");
      }

      description = localizedDescription;
    }

    await this.assertUsersExist(trainerUserIds);
    await this.assertCoursesExist(linkedCourseIds);
    await this.assertResourcesExist(allResourceIds);

    const liveTrainingId = await this.liveTrainingRepository.createLiveTrainingRecord({
      calendarEvent: {
        uid: `live-training-${randomUUID()}@mentingo`,
        status: CALENDAR_EVENT_STATUSES.SCHEDULED,
        baseLanguage: language,
        availableLocales,
        title,
        description,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        timezone: body.timezone,
        location: body.location ?? null,
        organizerUserId: currentUser.userId,
      },
      liveTraining: {
        authorId: currentUser.userId,
        baseLanguage: language,
        availableLocales,
        deliveryType: body.deliveryType,
        visibilityScope,
        status: LIVE_TRAINING_STATUSES.SCHEDULED,
        maxParticipants: this.getMaxParticipants(body.maxParticipants),
        settings: this.mergeSettings(body.settings),
      },
      trainers: this.getTrainerRows(trainerUserIds),
    });

    if (linkedCourseIds.length) {
      await this.liveTrainingRepository.insertLinks(
        liveTrainingId,
        this.getCourseLinkRows(linkedCourseIds),
      );
    }

    if (beforeResourceIds.length) {
      await this.liveTrainingRepository.insertResourceLinks(
        liveTrainingId,
        beforeResourceIds,
        LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
      );
    }

    if (afterResourceIds.length) {
      await this.liveTrainingRepository.insertResourceLinks(
        liveTrainingId,
        afterResourceIds,
        LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
      );
    }

    return this.getLiveTrainingDetailsOrThrow(liveTrainingId, language, currentUser);
  }

  async updateLiveTraining(
    id: UUIDType,
    body: UpdateLiveTrainingBody,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingDetails> {
    const row = await this.getEditableLiveTrainingOrThrow(id, language, currentUser);

    this.assertValidUpdateSchedule(body, row.startsAt, row.endsAt);

    const trainerUserIds = this.getUpdateTrainerUserIds(row.authorId, body.trainerUserIds);
    const linkedCourseIds = this.getOptionalUniqueIds(body.linkedCourseIds);
    const beforeResourceIds = this.getOptionalUniqueIds(body.beforeResourceIds);
    const afterResourceIds = this.getOptionalUniqueIds(body.afterResourceIds);

    await this.assertOptionalUsersExist(trainerUserIds);
    await this.assertOptionalCoursesExist(linkedCourseIds);
    await this.assertOptionalResourcesExist(beforeResourceIds, afterResourceIds);

    const availableLocales = [...row.availableLocales];

    if (this.hasLocalizedFieldChanges(body) && !availableLocales.includes(language)) {
      availableLocales.push(language);
    }

    const calendarEventUpdate = this.getCalendarEventUpdate(body, row.sequence, availableLocales);
    const liveTrainingUpdate = this.getLiveTrainingUpdate(
      body,
      linkedCourseIds,
      row.settings,
      availableLocales,
    );

    if (this.hasUpdateValues(calendarEventUpdate)) {
      await this.liveTrainingRepository.updateCalendarEvent(
        row.calendarEventId,
        calendarEventUpdate,
      );
    }

    if (this.hasUpdateValues(liveTrainingUpdate)) {
      await this.liveTrainingRepository.updateLiveTraining(row.id, liveTrainingUpdate);
    }

    if (trainerUserIds !== undefined) {
      await this.liveTrainingRepository.deleteTrainers(row.id);
      await this.liveTrainingRepository.insertTrainers(row.id, this.getTrainerRows(trainerUserIds));
    }

    if (linkedCourseIds !== undefined) {
      await this.liveTrainingRepository.deleteLinks(row.id);

      if (linkedCourseIds.length) {
        await this.liveTrainingRepository.insertLinks(
          row.id,
          this.getCourseLinkRows(linkedCourseIds),
        );
      }
    }

    if (beforeResourceIds !== undefined) {
      await this.liveTrainingRepository.deleteResourceLinks(
        row.id,
        LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
      );

      if (beforeResourceIds.length) {
        await this.liveTrainingRepository.insertResourceLinks(
          row.id,
          beforeResourceIds,
          LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
        );
      }
    }

    if (afterResourceIds !== undefined) {
      await this.liveTrainingRepository.deleteResourceLinks(
        row.id,
        LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
      );

      if (afterResourceIds.length) {
        await this.liveTrainingRepository.insertResourceLinks(
          row.id,
          afterResourceIds,
          LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
        );
      }
    }

    return this.getLiveTrainingDetailsOrThrow(id, language, currentUser);
  }

  async deleteLiveTraining(id: UUIDType, _currentUser: CurrentUserType): Promise<void> {
    const row = await this.liveTrainingRepository.getLiveTrainingBaseRow(id);

    if (!row) {
      throw new NotFoundException("liveTraining.errors.notFound");
    }

    await this.liveTrainingRepository.softDeleteLiveTraining(
      row.id,
      row.calendarEventId,
      row.sequence + 1,
    );
  }

  private async getLiveTrainingDetailsOrThrow(
    id: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingDetails> {
    const row = await this.liveTrainingRepository.getLiveTrainingBaseRow(id, language);

    if (!row) {
      throw new NotFoundException("liveTraining.errors.notFound");
    }

    const [trainers, linkedCourses, materials] = await Promise.all([
      this.liveTrainingRepository.getLiveTrainingTrainerRows(id),
      this.liveTrainingRepository.getLiveTrainingLinkedCourseRows(id, language),
      this.liveTrainingRepository.getLiveTrainingMaterialRows(
        id,
        [
          LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
          LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
        ],
        language,
      ),
    ]);

    if (!(await this.canSeeLiveTraining(row, trainers, linkedCourses, currentUser))) {
      throw new NotFoundException("liveTraining.errors.notFound");
    }

    const isPrivilegedViewer =
      this.canManage(currentUser) ||
      row.authorId === currentUser.userId ||
      trainers.some((trainer) => trainer.id === currentUser.userId);
    const visibleMaterials = this.getVisibleMaterials(materials, row.status, isPrivilegedViewer);
    const [authorProfilePictureUrl, trainersWithProfilePictures] = await Promise.all([
      this.getProfilePictureUrl(row.authorAvatarReference),
      this.getTrainersWithProfilePictureUrls(trainers),
    ]);

    return {
      id: row.id,
      calendarEventId: row.calendarEventId,
      title: row.title,
      description: row.description || null,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      timezone: row.timezone,
      location: row.location,
      deliveryType: row.deliveryType,
      visibilityScope: row.visibilityScope,
      status: row.status,
      maxParticipants: row.maxParticipants,
      authorId: row.authorId,
      trainerIds: trainers.map((trainer) => trainer.id),
      linkedCourseIds: linkedCourses.map((course) => course.id),
      settings: row.settings,
      metadata: row.metadata as Record<string, unknown>,
      author: {
        id: row.authorId,
        fullName: row.authorName,
        profilePictureUrl: authorProfilePictureUrl,
      },
      trainers: trainersWithProfilePictures,
      linkedCourses,
      materials: visibleMaterials,
    };
  }

  private async getEditableLiveTrainingOrThrow(
    id: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    const row = await this.liveTrainingRepository.getLiveTrainingBaseRow(id, language);

    if (!row) {
      throw new NotFoundException("liveTraining.errors.notFound");
    }

    if (
      !hasPermission(currentUser.permissions, PERMISSIONS.LIVE_TRAINING_UPDATE) &&
      !(
        hasPermission(currentUser.permissions, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN) &&
        row.authorId === currentUser.userId
      )
    ) {
      throw new NotFoundException("liveTraining.errors.notFound");
    }

    return row;
  }

  private async canSeeLiveTraining(
    row: LiveTrainingVisibilityRow,
    trainers: LiveTrainingVisibilityTrainer[],
    linkedCourses: LiveTrainingVisibilityLinkedCourse[],
    currentUser: CurrentUserType,
  ) {
    if (this.canManage(currentUser)) return true;
    if (row.authorId === currentUser.userId) return true;
    if (trainers.some((trainer) => trainer.id === currentUser.userId)) return true;
    if (row.visibilityScope === LIVE_TRAINING_VISIBILITY_SCOPES.ALL) return true;

    const enrolledCourseIds = await this.liveTrainingRepository.getEnrolledCourseIds(
      currentUser.userId,
      linkedCourses.map((course) => course.id),
    );

    return enrolledCourseIds.length > 0;
  }

  private getVisibleMaterials(
    materials: Awaited<ReturnType<LiveTrainingRepository["getLiveTrainingMaterialRows"]>>,
    status: string,
    isPrivilegedViewer: boolean,
  ) {
    const before = this.mapMaterialsByRelationshipType(
      materials,
      LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
    );
    const after = this.mapMaterialsByRelationshipType(
      materials,
      LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
    );

    if (isPrivilegedViewer) return { before, after };
    if (status === LIVE_TRAINING_STATUSES.ENDED) return { before: [], after };

    return { before, after: [] };
  }

  private mapMaterialsByRelationshipType(
    materials: Awaited<ReturnType<LiveTrainingRepository["getLiveTrainingMaterialRows"]>>,
    relationshipType: LiveTrainingResourceRelationshipType,
  ) {
    return materials
      .filter((material) => this.hasRelationshipType(material.relationshipType, relationshipType))
      .map((material) => ({
        ...material,
        description: material.description || null,
        relationshipType,
      }));
  }

  private async getTrainersWithProfilePictureUrls(
    trainers: Awaited<ReturnType<LiveTrainingRepository["getLiveTrainingTrainerRows"]>>,
  ) {
    return Promise.all(
      trainers.map(async ({ avatarReference, ...trainer }) => ({
        ...trainer,
        profilePictureUrl: await this.getProfilePictureUrl(avatarReference),
      })),
    );
  }

  private async getProfilePictureUrl(avatarReference: string | null) {
    if (!avatarReference) return null;

    return this.fileService.getFileUrl(avatarReference);
  }

  private canManage(currentUser: CurrentUserType) {
    return hasAnyPermission(currentUser.permissions, [
      PERMISSIONS.LIVE_TRAINING_UPDATE,
      PERMISSIONS.LIVE_TRAINING_DELETE,
      PERMISSIONS.LIVE_TRAINING_STATISTICS,
    ]);
  }

  private getListConditions(query: LiveTrainingListQuery) {
    const conditions: SQL[] = [isNull(liveTrainings.deletedAt), isNull(calendarEvents.deletedAt)];

    if (query.status) {
      conditions.push(eq(liveTrainings.status, query.status));
    }

    if (query.deliveryType) {
      conditions.push(eq(liveTrainings.deliveryType, query.deliveryType));
    }

    if (query.start && query.end) {
      const dateRangeCondition = and(
        lt(calendarEvents.startsAt, query.end),
        gt(calendarEvents.endsAt, query.start),
      );

      if (dateRangeCondition) {
        conditions.push(dateRangeCondition);
      }
    }

    if (query.courseId) {
      const linkedCourseCondition = and(
        eq(liveTrainingLinks.entityType, LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE),
        eq(liveTrainingLinks.entityId, query.courseId),
      );

      if (linkedCourseCondition) {
        conditions.push(linkedCourseCondition);
      }
    }

    return conditions;
  }

  private assertValidRangeFilters(start?: string, end?: string) {
    if ((start && !end) || (!start && end)) {
      throw new BadRequestException("liveTraining.errors.invalidDateRange");
    }

    if (start && end) {
      this.assertValidSchedule(start, end);
    }
  }

  private assertValidSchedule(startsAt: string, endsAt: string) {
    const startsAtTime = Date.parse(startsAt);
    const endsAtTime = Date.parse(endsAt);

    if (Number.isNaN(startsAtTime) || Number.isNaN(endsAtTime) || endsAtTime <= startsAtTime) {
      throw new BadRequestException("liveTraining.errors.invalidSchedule");
    }
  }

  private assertValidUpdateSchedule(
    body: UpdateLiveTrainingBody,
    currentStartsAt: string,
    currentEndsAt: string,
  ) {
    if (!body.startsAt && !body.endsAt) {
      return;
    }

    let startsAt = currentStartsAt;
    let endsAt = currentEndsAt;

    if (body.startsAt) {
      startsAt = body.startsAt;
    }

    if (body.endsAt) {
      endsAt = body.endsAt;
    }

    this.assertValidSchedule(startsAt, endsAt);
  }

  private deriveVisibilityScope(linkedCourseIds: UUIDType[]): LiveTrainingVisibilityScope {
    if (linkedCourseIds.length > 0) {
      return LIVE_TRAINING_VISIBILITY_SCOPES.LINKED_COURSES;
    }

    return LIVE_TRAINING_VISIBILITY_SCOPES.ALL;
  }

  private getCalendarEventUpdate(
    body: UpdateLiveTrainingBody,
    currentSequence: number,
    availableLocales: SupportedLanguages[],
  ): CalendarEventUpdateInput {
    const update: CalendarEventUpdateInput = {};

    if (body.title !== undefined) {
      const title = setJsonbField(calendarEvents.title, body.language, body.title);

      if (!title) {
        throw new BadRequestException("liveTraining.errors.invalidLocalizedField");
      }

      update.title = title;
    }

    if (body.description !== undefined) {
      if (body.description === null) {
        update.description = null;
      } else {
        const description = setJsonbField(
          calendarEvents.description,
          body.language,
          body.description,
        );

        if (!description) {
          throw new BadRequestException("liveTraining.errors.invalidLocalizedField");
        }

        update.description = description;
      }
    }

    if (this.hasLocalizedFieldChanges(body)) {
      update.availableLocales = availableLocales;
    }

    if (body.startsAt !== undefined) {
      update.startsAt = body.startsAt;
    }

    if (body.endsAt !== undefined) {
      update.endsAt = body.endsAt;
    }

    if (body.timezone !== undefined) {
      update.timezone = body.timezone;
    }

    if (body.location !== undefined) {
      update.location = body.location;
    }

    if (this.hasCalendarVisibleChanges(body)) {
      update.sequence = currentSequence + 1;
    }

    return update;
  }

  private getLiveTrainingUpdate(
    body: UpdateLiveTrainingBody,
    linkedCourseIds: UUIDType[] | undefined,
    currentSettings: LiveTrainingSettings,
    availableLocales: SupportedLanguages[],
  ): LiveTrainingUpdateInput {
    const update: LiveTrainingUpdateInput = {};

    if (this.hasLocalizedFieldChanges(body)) {
      update.availableLocales = availableLocales;
    }

    if (body.deliveryType !== undefined) {
      update.deliveryType = body.deliveryType;
    }

    if (body.status !== undefined) {
      update.status = body.status;
    }

    if (body.maxParticipants !== undefined) {
      update.maxParticipants = body.maxParticipants;
    }

    if (body.settings !== undefined) {
      update.settings = this.mergeSettings(body.settings, currentSettings);
    }

    if (linkedCourseIds !== undefined) {
      update.visibilityScope = this.deriveVisibilityScope(linkedCourseIds);
    }

    return update;
  }

  private getCreateTrainerUserIds(authorId: UUIDType, trainerUserIds?: UUIDType[]) {
    const userIds = [authorId];

    if (trainerUserIds) {
      userIds.push(...trainerUserIds);
    }

    return this.uniqueIds(userIds);
  }

  private getUpdateTrainerUserIds(authorId: UUIDType, trainerUserIds?: UUIDType[]) {
    if (trainerUserIds === undefined) {
      return undefined;
    }

    return this.uniqueIds([authorId, ...trainerUserIds]);
  }

  private getTrainerRows(userIds: UUIDType[]): LiveTrainingTrainerInput {
    return userIds.map((userId, index) => ({
      userId,
      role: LIVE_TRAINING_MEMBER_ROLES.TRAINER,
      displayOrder: index,
    }));
  }

  private getCourseLinkRows(courseIds: UUIDType[]): LiveTrainingLinkInput {
    return courseIds.map((entityId) => ({
      entityType: LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE,
      entityId,
    }));
  }

  private getUniqueIds(ids?: UUIDType[]) {
    if (!ids) {
      return [];
    }

    return this.uniqueIds(ids);
  }

  private getOptionalUniqueIds(ids?: UUIDType[]) {
    if (ids === undefined) {
      return undefined;
    }

    return this.uniqueIds(ids);
  }

  private getMaxParticipants(maxParticipants?: number) {
    if (maxParticipants !== undefined) {
      return maxParticipants;
    }

    return LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT;
  }

  private hasUpdateValues(update: Record<string, unknown>) {
    return Object.keys(update).length > 0;
  }

  private mergeSettings(
    settings?: CreateLiveTrainingBody["settings"],
    baseSettings: LiveTrainingSettings = DEFAULT_LIVE_TRAINING_SETTINGS,
  ): LiveTrainingSettings {
    return {
      viewerPermissions: {
        ...baseSettings.viewerPermissions,
        ...settings?.viewerPermissions,
      },
    };
  }

  private hasCalendarVisibleChanges(body: UpdateLiveTrainingBody) {
    return (
      body.title !== undefined ||
      body.description !== undefined ||
      body.startsAt !== undefined ||
      body.endsAt !== undefined ||
      body.timezone !== undefined ||
      body.location !== undefined
    );
  }

  private hasLocalizedFieldChanges(body: UpdateLiveTrainingBody) {
    return body.title !== undefined || body.description !== undefined;
  }

  private async assertUsersExist(userIds: UUIDType[]) {
    if (!userIds.length) return;

    const existing = await this.liveTrainingRepository.getExistingUserIds(userIds);
    this.assertAllIdsExist(
      userIds,
      existing.map((user) => user.id),
      "liveTraining.errors.invalidTrainer",
    );
  }

  private async assertOptionalUsersExist(userIds?: UUIDType[]) {
    if (userIds === undefined) {
      return;
    }

    await this.assertUsersExist(userIds);
  }

  private async assertCoursesExist(courseIds: UUIDType[]) {
    if (!courseIds.length) return;

    const existing = await this.liveTrainingRepository.getExistingCourseIds(courseIds);
    this.assertAllIdsExist(
      courseIds,
      existing.map((course) => course.id),
      "liveTraining.errors.invalidCourse",
    );
  }

  private async assertOptionalCoursesExist(courseIds?: UUIDType[]) {
    if (courseIds === undefined) {
      return;
    }

    await this.assertCoursesExist(courseIds);
  }

  private async assertResourcesExist(resourceIds: UUIDType[]) {
    if (!resourceIds.length) return;

    const existing = await this.liveTrainingRepository.getExistingResourceIds(resourceIds);
    this.assertAllIdsExist(
      resourceIds,
      existing.map((resource) => resource.id),
      "liveTraining.errors.invalidResource",
    );
  }

  private async assertOptionalResourcesExist(
    beforeResourceIds?: UUIDType[],
    afterResourceIds?: UUIDType[],
  ) {
    const resourceIds: UUIDType[] = [];

    if (beforeResourceIds) {
      resourceIds.push(...beforeResourceIds);
    }

    if (afterResourceIds) {
      resourceIds.push(...afterResourceIds);
    }

    await this.assertResourcesExist(this.uniqueIds(resourceIds));
  }

  private assertAllIdsExist(requestedIds: UUIDType[], existingIds: UUIDType[], errorKey: string) {
    const existingSet = new Set(existingIds);
    const hasMissing = requestedIds.some((id) => !existingSet.has(id));

    if (hasMissing) {
      throw new BadRequestException(errorKey);
    }
  }

  private uniqueIds(ids: UUIDType[]) {
    return [...new Set(ids)];
  }

  private hasRelationshipType(
    value: string,
    relationshipType: LiveTrainingResourceRelationshipType,
  ): value is LiveTrainingResourceRelationshipType {
    return value === relationshipType;
  }
}
