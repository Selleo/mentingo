import { Body, Controller, Get, Param, Post, UseGuards, Patch, Query } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";

import { AnnouncementsService } from "./announcements.service";
import {
  allAnnouncementsSchema,
  announcementsForUserSchema,
  baseAnnouncementSchema,
  unreadAnnouncementsSchema,
  userAnnouncementsSchema,
} from "./schemas/announcement.schema";
import { createAnnouncementSchema } from "./schemas/createAnnouncement.schema";
import { CreateAnnouncement } from "./types/announcement.types";

import type { AnnouncementFilters } from "./types/announcement.types";

@UseGuards(PermissionsGuard)
@Controller("announcements")
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ANNOUNCEMENT_READ)
  @Validate({
    response: baseResponse(allAnnouncementsSchema),
  })
  async getAllAnnouncements() {
    const announcements = await this.announcementsService.getAllAnnouncements();

    return new BaseResponse(announcements);
  }

  @Get("latest")
  @RequirePermission(PERMISSIONS.ANNOUNCEMENT_READ)
  @Validate({
    response: baseResponse(allAnnouncementsSchema),
  })
  async getLatestUnreadAnnouncements(@CurrentUser("userId") userId: UUIDType) {
    const announcements = await this.announcementsService.getLatestUnreadAnnouncements(userId);

    return new BaseResponse(announcements);
  }

  @Get("unread")
  @RequirePermission(PERMISSIONS.ANNOUNCEMENT_READ)
  @Validate({
    response: baseResponse(unreadAnnouncementsSchema),
  })
  async getUnreadAnnouncementsCount(@CurrentUser("userId") userId: UUIDType) {
    const unreadAnnouncementsCount = await this.announcementsService.getUnreadAnnouncementsCount(
      userId,
    );

    return new BaseResponse(unreadAnnouncementsCount);
  }

  @Get("user/me")
  @RequirePermission(PERMISSIONS.ANNOUNCEMENT_READ)
  @Validate({
    request: [
      { type: "query", name: "title", schema: Type.Optional(Type.String()) },
      { type: "query", name: "content", schema: Type.Optional(Type.String()) },
      { type: "query", name: "authorName", schema: Type.Optional(Type.String()) },
      { type: "query", name: "search", schema: Type.Optional(Type.String()) },
      { type: "query", name: "isRead", schema: Type.Optional(Type.String()) },
    ],
    response: baseResponse(announcementsForUserSchema),
  })
  async getAnnouncementsForUser(
    @Query("title") title?: string,
    @Query("content") content?: string,
    @Query("authorName") authorName?: string,
    @Query("search") search?: string,
    @Query("isRead") isRead?: string,
    @CurrentUser("userId") userId?: UUIDType,
  ) {
    const filters: AnnouncementFilters = {
      title,
      content,
      authorName,
      search,
      isRead: isRead ? isRead === "true" : undefined,
    };
    const announcements = await this.announcementsService.getAnnouncementsForUser(userId!, filters);

    return new BaseResponse(announcements);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ANNOUNCEMENT_CREATE)
  @Validate({
    request: [{ type: "body", schema: createAnnouncementSchema }],
    response: baseResponse(baseAnnouncementSchema),
  })
  async createAnnouncement(
    @Body() createAnnouncementData: CreateAnnouncement,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const announcement = await this.announcementsService.createAnnouncement(
      createAnnouncementData,
      currentUser,
    );

    return new BaseResponse(announcement);
  }

  @Patch(":id/read")
  @RequirePermission(PERMISSIONS.ANNOUNCEMENT_READ)
  @Validate({
    response: baseResponse(userAnnouncementsSchema),
  })
  async markAnnouncementAsRead(
    @Param("id") announcementId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const announcement = await this.announcementsService.markAnnouncementAsRead(
      announcementId,
      currentUser,
    );

    return new BaseResponse(announcement);
  }
}
