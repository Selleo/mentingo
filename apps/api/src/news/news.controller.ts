import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { NewsService } from "./news.service";
import { CreateNews, createNewsSchema } from "./schemas/createNews.schema";
import { createNewsResponseSchema } from "./schemas/selectNews.schema";
import { UpdateNews, updateNewsSchema } from "./schemas/updateNews.schema";

@Controller("news")
@UseGuards(RolesGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @Validate({
    request: [{ type: "body", schema: createNewsSchema }],
    response: baseResponse(createNewsResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async createNews(
    @Body() createNewsBody: CreateNews,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdNews = await this.newsService.createNews(createNewsBody, currentUser);

    return new BaseResponse(createdNews);
  }

  @Patch(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateNewsSchema },
    ],
    response: baseResponse(createNewsResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async updateNews(@Param("id") id: string, @Body() updateNewsBody: UpdateNews) {
    const updatedNews = await this.newsService.updateNews(id, updateNewsBody);

    return new BaseResponse(updatedNews);
  }

  @ApiOperation({ summary: "Add a new language to a news item" })
  @Post(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: createNewsSchema },
    ],
    response: baseResponse(createNewsResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async addNewLanguage(@Param("id") id: string, @Body() createLanguageBody: CreateNews) {
    const createdLanguage = await this.newsService.createNewsLanguage(id, createLanguageBody);

    return new BaseResponse(createdLanguage);
  }
}
