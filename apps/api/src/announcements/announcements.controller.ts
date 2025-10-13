import { Body, Controller, Get, Param, Post, UseGuards, Patch, Query } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDType } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

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

@UseGuards(RolesGuard)
@Controller("announcements")
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    response: baseResponse(allAnnouncementsSchema),
  })
  async getAllAnnouncements() {
    const announcements = await this.announcementsService.getAllAnnouncements();

    return new BaseResponse(announcements);
  }

  @Get("latest")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    response: baseResponse(allAnnouncementsSchema),
  })
  async getLatestUnreadAnnouncements(@CurrentUser("userId") userId: UUIDType) {
    const announcements = await this.announcementsService.getLatestUnreadAnnouncements(userId);

    return new BaseResponse(announcements);
  }

  @Get("unread")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    response: baseResponse(unreadAnnouncementsSchema),
  })
  async getUnreadAnnouncementsCount(@CurrentUser("userId") userId: UUIDType) {
    const unreadAnnouncementsCount =
      await this.announcementsService.getUnreadAnnouncementsCount(userId);

    return new BaseResponse(unreadAnnouncementsCount);
  }

  @Get("user/me")
  @Roles(...Object.values(USER_ROLES))
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
    //@ts-expect-error - userId is required and has to be last because of the validator
    @CurrentUser("userId") userId: UUIDType,
  ) {
    const filters: AnnouncementFilters = {
      title,
      content,
      authorName,
      search,
      isRead: isRead ? isRead === "true" : undefined,
    };

    const announcements = await this.announcementsService.getAnnouncementsForUser(userId, filters);

    return new BaseResponse(announcements);
  }

  @Post()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [{ type: "body", schema: createAnnouncementSchema }],
    response: baseResponse(baseAnnouncementSchema),
  })
  async createAnnouncement(
    @Body() createAnnouncementData: CreateAnnouncement,
    @CurrentUser("userId") authorId: UUIDType,
  ) {
    const announcement = await this.announcementsService.createAnnouncement(
      createAnnouncementData,
      authorId,
    );

    return new BaseResponse(announcement);
  }

  @Patch(":id/read")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    response: baseResponse(userAnnouncementsSchema),
  })
  async markAnnouncementAsRead(
    @Param("id") announcementId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    const announcement = await this.announcementsService.markAnnouncementAsRead(
      announcementId,
      userId,
    );

    return new BaseResponse(announcement);
  }
}
