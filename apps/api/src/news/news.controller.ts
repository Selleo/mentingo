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
  Req,
  Res,
  UploadedFile,
  UseInterceptors, UseGuards } from "@nestjs/common";
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
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, PaginatedResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";
import { PermissionsGuard } from "src/permission/permission.guard";
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

@UseGuards(PermissionsGuard)
@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get("drafts")
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
    ],
    response: paginatedNewsListResponseSchema,
  })
  async getDraftNewsList(
    @Query("language") language: SupportedLanguages,
    @Query("page") page = 1,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<GetNewsResponse[]>> {
    const newsList = await this.newsService.getDraftNewsList(language, page, currentUser);

    return new PaginatedResponse(newsList);
  }

  @Post("preview")
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
  @Validate({
    request: [{ type: "body", schema: previewNewsRequestSchema }],
    response: baseResponse(previewNewsResponseSchema),
  })
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
  @RequirePermission(PERMISSIONS.NEWS_READ_PUBLIC)
  @Validate({
    request: [{ type: "param", schema: UUIDSchema, name: "resourceId" }],
  })
  async getNewsResource(
    @Param("resourceId") resourceId: UUIDType,
    @CurrentUser("userId") userId: UUIDType | undefined,
    @CurrentUser("role") role: UserRole | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.newsService.getNewsResource(req, res, resourceId, userId, role);
  }

  @Public()
  @Get(":id")
  @RequirePermission(PERMISSIONS.NEWS_READ_PUBLIC)
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
  @RequirePermission(PERMISSIONS.NEWS_READ_PUBLIC)
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
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createNewsSchema }],
    response: baseResponse(createNewsResponseSchema),
  })
  async createNews(
    @Body() createNewsBody: CreateNews,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdNews = await this.newsService.createNews(createNewsBody, currentUser);

    return new BaseResponse(createdNews);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
  @UseInterceptors(FileInterceptor("cover"))
  @ApiConsumes("multipart/form-data")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateNewsSchema },
    ],
    response: baseResponse(createNewsResponseSchema),
  })
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
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: createNewsSchema },
    ],
    response: baseResponse(createNewsResponseSchema),
  })
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
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(deleteNewsLanguageResponseSchema),
  })
  async deleteNewsLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    const updatedNews = await this.newsService.deleteNewsLanguage(id, language, currentUser);

    return new BaseResponse(updatedNews);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(deleteNewsResponseSchema),
  })
  async deleteNews(@Param("id") id: string, @CurrentUser() currentUser?: CurrentUserType) {
    const deletedNews = await this.newsService.deleteNews(id, currentUser);

    return new BaseResponse(deletedNews);
  }

  @Post(":id/upload")
  @RequirePermission(PERMISSIONS.NEWS_MANAGE)
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
