import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOperation } from "@nestjs/swagger";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, PaginatedResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import { NewsService } from "./news.service";
import { CreateNews, createNewsSchema } from "./schemas/createNews.schema";
import {
  deleteNewsLanguageResponseSchema,
  deleteNewsResponseSchema,
} from "./schemas/deleteNews.schema";
import {
  createNewsResponseSchema,
  getNewsResponseSchema,
  paginatedNewsListResponseSchema,
  uploadNewsFileResponseSchema,
} from "./schemas/selectNews.schema";
import { UpdateNews, updateNewsSchema } from "./schemas/updateNews.schema";

import type { GetNewsResponse } from "./schemas/selectNews.schema";

@Controller("news")
@UseGuards(RolesGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(getNewsResponseSchema),
  })
  @Roles(...Object.values(USER_ROLES))
  async getNews(@Param("id") id: string, @Query("language") language: SupportedLanguages) {
    const news = await this.newsService.getNews(id, language);

    return new BaseResponse(news);
  }

  @Get()
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
    ],
    response: paginatedNewsListResponseSchema,
  })
  @Roles(...Object.values(USER_ROLES))
  async getNewsList(
    @Query("language") language: SupportedLanguages,
    @Query("page") page = 1,
  ): Promise<PaginatedResponse<GetNewsResponse[]>> {
    const newsList = await this.newsService.getNewsList(language, page);

    return new PaginatedResponse(newsList);
  }

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
  @UseInterceptors(FileInterceptor("cover"))
  @ApiConsumes("multipart/form-data")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateNewsSchema },
    ],
    response: baseResponse(createNewsResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async updateNews(
    @Param("id") id: string,
    @Body(new ValidateMultipartPipe(updateNewsSchema)) updateNewsBody: UpdateNews,
    @UploadedFile() cover?: Express.Multer.File,
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    const updatedNews = await this.newsService.updateNews(id, updateNewsBody, currentUser, cover);

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

  @Delete(":id/language")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(deleteNewsLanguageResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async deleteNewsLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
  ) {
    const updatedNews = await this.newsService.deleteNewsLanguage(id, language);

    return new BaseResponse(updatedNews);
  }

  @Delete(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(deleteNewsResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async deleteNews(@Param("id") id: string, @CurrentUser() currentUser?: CurrentUserType) {
    const deletedNews = await this.newsService.deleteNews(id, currentUser);

    return new BaseResponse(deletedNews);
  }

  @Post(":id/upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        language: {
          type: "string",
          enum: ["en", "pl"],
        },
        title: {
          type: "string",
        },
        description: {
          type: "string",
        },
      },
      required: ["file", "language", "title", "description"],
    },
  })
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(uploadNewsFileResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async uploadFileToNews(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("language") language: SupportedLanguages,
    @Body("title") title: string,
    @Body("description") description: string,
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    const fileData = await this.newsService.uploadFileToNews(
      id,
      file,
      language,
      title,
      description,
      currentUser,
    );

    return new BaseResponse(fileData);
  }
}
