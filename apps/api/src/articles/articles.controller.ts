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
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation } from "@nestjs/swagger";
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

import {
  type PreviewArticleRequest,
  previewArticleRequestSchema,
  type PreviewArticleResponse,
  previewArticleResponseSchema,
} from "src/articles/schemas/previewArticle.schema";
import { BaseResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";
import { PermissionsGuard } from "src/permission/permission.guard";
import { UserRole } from "src/user/schemas/userRoles";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import { getArticleSectionResponseSchema as getArticleSectionDetailsResponseSchema } from "./schemas/articleSection.schema";
import {
  type GetArticleTocResponse,
  getArticleSectionResponseSchema,
} from "./schemas/articleToc.schema";
import {
  CreateArticle,
  createArticleSchema,
  CreateArticleSection,
  createArticleSectionSchema,
  CreateLanguageArticle,
  createLanguageArticleSchema,
  UploadFile,
  uploadFileSchema,
} from "./schemas/createArticle.schema";
import {
  createArticleResponseSchema,
  createArticleSectionResponseSchema,
  getArticleResponseSchema,
  uploadArticleFileResponseSchema,
  getArticlesResponseSchema,
  type GetArticlesResponse,
  type GetArticleResponse,
} from "./schemas/selectArticle.schema";
import {
  UpdateArticle,
  updateArticleSchema,
  UpdateArticleSection,
  updateArticleSectionSchema,
} from "./schemas/updateArticle.schema";
import { ArticlesService } from "./services/articles.service";

@UseGuards(PermissionsGuard)
@Controller("articles")
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post("section")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createArticleSectionSchema }],
    response: baseResponse(createArticleSectionResponseSchema),
  })
  async createArticleSection(
    @Body() createArticleSectionBody: CreateArticleSection,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdArticle = await this.articlesService.createArticleSection(
      createArticleSectionBody,
      currentUser,
    );

    return new BaseResponse(createdArticle);
  }

  @Get("section/:id")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(getArticleSectionDetailsResponseSchema),
  })
  async getArticleSection(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const section = await this.articlesService.getArticleSection(id, language, currentUser);

    return new BaseResponse(section);
  }

  @Patch("section/:id")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateArticleSectionSchema },
    ],
    response: baseResponse(createArticleSectionResponseSchema),
  })
  async updateArticleSection(
    @Param("id") id: UUIDType,
    @Body() updateArticleSectionBody: UpdateArticleSection,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const updatedSection = await this.articlesService.updateArticleSection(
      id,
      updateArticleSectionBody,
      currentUser,
    );

    return new BaseResponse(updatedSection);
  }

  @ApiOperation({ summary: "Add a new language to an article section" })
  @Post("section/:id/language")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: createArticleSectionSchema },
    ],
    response: baseResponse(createArticleSectionResponseSchema),
  })
  async addNewLanguageToSection(
    @Param("id") id: UUIDType,
    @Body() createLanguageBody: CreateArticleSection,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdLanguage = await this.articlesService.createArticleSectionLanguage(
      id,
      createLanguageBody,
      currentUser,
    );

    return new BaseResponse(createdLanguage);
  }

  @Delete("section/:id/language")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  async deleteArticleSectionLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.articlesService.deleteArticleSectionLanguage(id, language, currentUser);
  }

  @Delete("section/:id")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
  })
  async deleteArticleSection(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.articlesService.deleteArticleSection(id, currentUser);
  }

  @Get("drafts")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: getArticlesResponseSchema,
  })
  async getDraftArticles(
    @Query("language") language: SupportedLanguages,
  ): Promise<GetArticlesResponse> {
    return this.articlesService.getDraftArticles(language);
  }

  @Public()
  @Get("toc")
  @RequirePermission(PERMISSIONS.ARTICLE_READ_PUBLIC)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "isDraftMode", schema: Type.Optional(Type.Boolean()) },
    ],
    response: baseResponse(getArticleSectionResponseSchema),
  })
  async getArticleToc(
    @Query("language") language: SupportedLanguages,
    @Query("isDraftMode") isDraftMode?: boolean,
    @CurrentUser() currentUser?: CurrentUserType,
  ): Promise<BaseResponse<GetArticleTocResponse>> {
    const toc = await this.articlesService.getArticlesToc(language, isDraftMode, currentUser);

    return new BaseResponse(toc);
  }

  @Public()
  @Get("articles-resource/:resourceId")
  @RequirePermission(PERMISSIONS.ARTICLE_READ_PUBLIC)
  @Validate({
    request: [{ type: "param", schema: UUIDSchema, name: "resourceId" }],
  })
  async getArticleResource(
    @Param("resourceId") resourceId: UUIDType,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser("userId") userId?: UUIDType,
    @CurrentUser("role") role?: UserRole,
  ) {
    return this.articlesService.getArticleResource(req, res, resourceId, userId, role);
  }

  @Public()
  @Get(":id")
  @RequirePermission(PERMISSIONS.ARTICLE_READ_PUBLIC)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "isDraftMode", schema: Type.Optional(Type.Boolean()) },
    ],
    response: baseResponse(getArticleResponseSchema),
  })
  async getArticle(
    @Param("id") id: string,
    @Query("language") language: SupportedLanguages,
    @Query("isDraftMode") isDraftMode?: boolean,
    @CurrentUser() currentUser?: CurrentUserType,
  ): Promise<BaseResponse<GetArticleResponse>> {
    const article = await this.articlesService.getArticle(id, language, isDraftMode, currentUser);

    return new BaseResponse(article);
  }

  @Public()
  @Get()
  @RequirePermission(PERMISSIONS.ARTICLE_READ_PUBLIC)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "searchQuery", schema: Type.Optional(Type.String()) },
    ],
    response: getArticlesResponseSchema,
  })
  async getArticles(
    @Query("language") language: SupportedLanguages,
    @Query("searchQuery") searchQuery?: string,
    @CurrentUser() currentUser?: CurrentUserType,
  ): Promise<GetArticlesResponse> {
    return this.articlesService.getArticles(language, currentUser, searchQuery);
  }

  @Post("article")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createArticleSchema }],
    response: baseResponse(createArticleResponseSchema),
  })
  async createArticle(
    @Body() createArticleBody: CreateArticle,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdNews = await this.articlesService.createArticle(createArticleBody, currentUser);

    return new BaseResponse(createdNews);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @UseInterceptors(FileInterceptor("cover"))
  @ApiConsumes("multipart/form-data")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateArticleSchema },
    ],
    response: baseResponse(createArticleResponseSchema),
  })
  async updateArticle(
    @Param("id") id: string,
    @Body(new ValidateMultipartPipe(updateArticleSchema)) updateArticleBody: UpdateArticle,
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES)).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    cover?: Express.Multer.File,
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    const updatedArticle = await this.articlesService.updateArticle(
      id,
      updateArticleBody,
      currentUser,
      cover,
    );

    return new BaseResponse(updatedArticle);
  }

  @ApiOperation({ summary: "Add a new language to an article" })
  @Post("article/:id")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: createLanguageArticleSchema },
    ],
    response: baseResponse(createArticleResponseSchema),
  })
  async addNewLanguage(
    @Param("id") id: string,
    @Body() createLanguageBody: CreateLanguageArticle,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdLanguage = await this.articlesService.createArticleLanguage(
      id,
      createLanguageBody,
      currentUser,
    );

    return new BaseResponse(createdLanguage);
  }

  @Delete(":id/language")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  async deleteArticleLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.articlesService.deleteArticleLanguage(id, language, currentUser);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
  })
  async deleteArticle(@Param("id") id: string, @CurrentUser() currentUser?: CurrentUserType) {
    await this.articlesService.deleteArticle(id, currentUser);
  }

  @Post(":id/upload")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: uploadFileSchema },
    ],
    response: baseResponse(uploadArticleFileResponseSchema),
  })
  async uploadFileToArticle(
    @Param("id") id: string,
    @Body(new ValidateMultipartPipe(uploadFileSchema)) uploadFileBody: UploadFile,
    @UploadedFile(
      "file",
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
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    const fileData = await this.articlesService.uploadFileToArticle(
      id,
      file,
      uploadFileBody.language,
      uploadFileBody.title,
      uploadFileBody.description,
      currentUser,
    );

    return new BaseResponse(fileData);
  }

  @Post("preview")
  @RequirePermission(PERMISSIONS.ARTICLE_MANAGE)
  @Validate({
    request: [{ type: "body", schema: previewArticleRequestSchema }],
    response: baseResponse(previewArticleResponseSchema),
  })
  async generateArticlePreview(
    @Body() body: PreviewArticleRequest,
  ): Promise<BaseResponse<PreviewArticleResponse>> {
    const { articleId, language, content } = body;
    const previewContent = await this.articlesService.generateArticlePreview(
      articleId,
      language,
      content,
    );

    return new BaseResponse({ parsedContent: previewContent });
  }
}
