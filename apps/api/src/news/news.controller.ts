import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOperation } from "@nestjs/swagger";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  SupportedLanguages,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, PaginatedResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import { NewsService } from "./news.service";
import { CreateNews, createNewsSchema } from "./schemas/createNews.schema";
import {
  deleteNewsLanguageResponseSchema,
  deleteNewsResponseSchema,
} from "./schemas/deleteNews.schema";
import { previewNewsRequestSchema, previewNewsResponseSchema } from "./schemas/previewNews.schema";
import {
  createNewsResponseSchema,
  getNewsWithPlainContentSchema,
  paginatedNewsListResponseSchema,
  uploadNewsFileResponseSchema,
} from "./schemas/selectNews.schema";
import { UpdateNews, updateNewsSchema } from "./schemas/updateNews.schema";

import type { GetNewsResponse, GetNewsResponseWithPlainContent } from "./schemas/selectNews.schema";
import type { UserRole } from "src/user/schemas/userRoles";

@Controller("news")
@UseGuards(RolesGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get("drafts")
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
    ],
    response: paginatedNewsListResponseSchema,
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async getDraftNewsList(
    @Query("language") language: SupportedLanguages,
    @Query("page") page = 1,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<GetNewsResponse[]>> {
    const newsList = await this.newsService.getDraftNewsList(language, page, currentUser);

    return new PaginatedResponse(newsList);
  }

  @Post("preview")
  @Validate({
    request: [{ type: "body", schema: previewNewsRequestSchema }],
    response: baseResponse(previewNewsResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async generateNewsPreview(
    @Body() body: { newsId: UUIDType; language: SupportedLanguages; content: string },
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ parsedContent: string }>> {
    const { newsId, language, content } = body;
    const previewContent = await this.newsService.generateNewsPreview(
      newsId,
      language,
      content,
      currentUser,
    );

    return new BaseResponse({ parsedContent: previewContent });
  }

  @Public()
  @Get("news-resource/:resourceId")
  @Validate({
    request: [{ type: "param", schema: UUIDSchema, name: "resourceId" }],
  })
  async getNewsResource(
    @Param("resourceId") resourceId: UUIDType,
    @CurrentUser("userId") userId: UUIDType | undefined,
    @CurrentUser("role") role: UserRole | undefined,
    @Res() res: Response,
  ) {
    return this.newsService.getNewsResource(res, resourceId, userId, role);
  }

  @Public()
  @Get(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(getNewsWithPlainContentSchema),
  })
  async getNews(
    @Param("id") id: string,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser?: CurrentUserType,
  ): Promise<BaseResponse<GetNewsResponseWithPlainContent>> {
    const news = await this.newsService.getNews(id, language, currentUser);

    return new BaseResponse(news);
  }

  @Public()
  @Get()
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "searchQuery", schema: Type.Optional(Type.String()) },
    ],
    response: paginatedNewsListResponseSchema,
  })
  async getNewsList(
    @Query("language") language: SupportedLanguages,
    @Query("page") page = 1,
    @Query("searchQuery") searchQuery?: string,
    @CurrentUser() currentUser?: CurrentUserType,
  ): Promise<PaginatedResponse<GetNewsResponse[]>> {
    const newsList = await this.newsService.getNewsList(language, page, currentUser, searchQuery);

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
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES)).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    cover?: Express.Multer.File,
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
  async addNewLanguage(
    @Param("id") id: string,
    @Body() createLanguageBody: CreateNews,
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    const createdLanguage = await this.newsService.createNewsLanguage(
      id,
      createLanguageBody,
      currentUser,
    );

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
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    const updatedNews = await this.newsService.deleteNewsLanguage(id, language, currentUser);

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
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex([
          ...ALLOWED_PDF_FILE_TYPES,
          ...ALLOWED_EXCEL_FILE_TYPES,
          ...ALLOWED_WORD_FILE_TYPES,
          ...ALLOWED_VIDEO_FILE_TYPES,
          ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
          ...ALLOWED_PRESENTATION_FILE_TYPES,
        ]),
      ).build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
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
