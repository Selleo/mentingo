import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { COURSE_ORIGIN_TYPES, ENTITY_TYPES, PERMISSIONS } from "@repo/shared";
import { match } from "ts-pattern";

import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";

import { VideoUploadAuthorizationRepository } from "./video-upload-authorization.repository";

import type { VideoInitBody } from "./schemas/video-init.schema";
import type { PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class VideoUploadAuthorizationService {
  constructor(
    private readonly videoUploadAuthorizationRepository: VideoUploadAuthorizationRepository,
  ) {}

  async assertCanUpload(data: VideoInitBody, actor?: CurrentUserType): Promise<void> {
    if (!actor) throw new ForbiddenException("files.toast.uploadForbidden");

    await match(data.entityType)
      .with(ENTITY_TYPES.COURSE, ENTITY_TYPES.LESSON, () => this.assertCourseUpload(data, actor))
      .with(ENTITY_TYPES.NEWS, () =>
        this.assertEditorialUpload({
          entityId: data.entityId,
          actor,
          findAuthorId: (newsId) =>
            this.videoUploadAuthorizationRepository.findNewsAuthorId(newsId),
          managePermission: PERMISSIONS.NEWS_MANAGE,
          manageOwnPermission: PERMISSIONS.NEWS_MANAGE_OWN,
        }),
      )
      .with(ENTITY_TYPES.ARTICLES, () =>
        this.assertEditorialUpload({
          entityId: data.entityId,
          actor,
          findAuthorId: (articleId) =>
            this.videoUploadAuthorizationRepository.findArticleAuthorId(articleId),
          managePermission: PERMISSIONS.ARTICLE_MANAGE,
          manageOwnPermission: PERMISSIONS.ARTICLE_MANAGE_OWN,
        }),
      )
      .otherwise(() => {
        throw new ForbiddenException("files.toast.uploadForbidden");
      });
  }

  private async assertCourseUpload(data: VideoInitBody, actor: CurrentUserType): Promise<void> {
    this.assertEntityPermission(actor, PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN);
    if (!data.entityId) return;

    const course =
      data.entityType === ENTITY_TYPES.COURSE
        ? await this.videoUploadAuthorizationRepository.findCourseUploadTarget(data.entityId)
        : await this.videoUploadAuthorizationRepository.findLessonCourseUploadTarget(data.entityId);

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");
    if (!canUpdateCourseByAuthor(actor, course.authorId)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
    }
    if (course.originType === COURSE_ORIGIN_TYPES.EXPORTED) {
      throw new ForbiddenException("masterCourse.error.exportedCourseReadonly");
    }
  }

  private async assertEditorialUpload(params: {
    entityId: UUIDType | undefined;
    actor: CurrentUserType;
    findAuthorId: (entityId: UUIDType) => Promise<UUIDType | null | undefined>;
    managePermission: PermissionKey;
    manageOwnPermission: PermissionKey;
  }): Promise<void> {
    const { entityId, actor, managePermission, manageOwnPermission } = params;
    this.assertEntityPermission(actor, managePermission, manageOwnPermission);
    if (!entityId) return;

    const authorId = await params.findAuthorId(entityId);
    if (authorId === undefined) throw new NotFoundException("files.toast.uploadTargetNotFound");
    if (!hasPermission(actor.permissions, managePermission) && authorId !== actor.userId) {
      throw new ForbiddenException("files.toast.uploadForbidden");
    }
  }

  private assertEntityPermission(
    actor: CurrentUserType,
    managePermission: PermissionKey,
    manageOwnPermission: PermissionKey,
  ): void {
    if (!hasAnyPermission(actor.permissions, [managePermission, manageOwnPermission])) {
      throw new ForbiddenException("files.toast.uploadForbidden");
    }
  }
}
