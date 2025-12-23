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
import { ApiConsumes, ApiOperation } from "@nestjs/swagger";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  type PreviewArticleRequest,
  previewArticleRequestSchema,
  type PreviewArticleResponse,
  previewArticleResponseSchema,
} from "src/articles/schemas/previewArticle.schema";
import { BaseResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
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

@Controller("articles")
@UseGuards(RolesGuard)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post("section")
  @Validate({
    request: [{ type: "body", schema: createArticleSectionSchema }],
    response: baseResponse(createArticleSectionResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async createArticleSection(
    @Body() createArticleSectionBody: CreateArticleSection,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdNews = await this.articlesService.createArticleSection(
      createArticleSectionBody,
      currentUser,
    );

    return new BaseResponse(createdNews);
  }

  @Get("section/:id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(getArticleSectionDetailsResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async getArticleSection(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
  ) {
    const section = await this.articlesService.getArticleSection(id, language);
    return new BaseResponse(section);
  }

  @Patch("section/:id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateArticleSectionSchema },
    ],
    response: baseResponse(createArticleSectionResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: createArticleSectionSchema },
    ],
    response: baseResponse(createArticleSectionResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async deleteArticleSectionLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.articlesService.deleteArticleSectionLanguage(id, language, currentUser);
  }

  @Delete("section/:id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async deleteArticleSection(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.articlesService.deleteArticleSection(id, currentUser);
  }

  @Get("drafts")
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: getArticlesResponseSchema,
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async getDraftArticles(
    @Query("language") language: SupportedLanguages,
  ): Promise<GetArticlesResponse> {
    return this.articlesService.getDraftArticles(language);
  }

  @Public()
  @Get("toc")
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
  @Get(":id")
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
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: getArticlesResponseSchema,
  })
  async getArticles(
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser?: CurrentUserType,
  ): Promise<GetArticlesResponse> {
    return this.articlesService.getArticles(language, currentUser);
  }

  @Post("article")
  @Validate({
    request: [{ type: "body", schema: createArticleSchema }],
    response: baseResponse(createArticleResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async createArticle(
    @Body() createArticleBody: CreateArticle,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const createdNews = await this.articlesService.createArticle(createArticleBody, currentUser);

    return new BaseResponse(createdNews);
  }

  @Patch(":id")
  @UseInterceptors(FileInterceptor("cover"))
  @ApiConsumes("multipart/form-data")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateArticleSchema },
    ],
    response: baseResponse(createArticleResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async updateArticle(
    @Param("id") id: string,
    @Body(new ValidateMultipartPipe(updateArticleSchema)) updateArticleBody: UpdateArticle,
    @UploadedFile() cover?: Express.Multer.File,
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
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: createLanguageArticleSchema },
    ],
    response: baseResponse(createArticleResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async deleteArticleLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.articlesService.deleteArticleLanguage(id, language, currentUser);
  }

  @Delete(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async deleteArticle(@Param("id") id: string, @CurrentUser() currentUser?: CurrentUserType) {
    await this.articlesService.deleteArticle(id, currentUser);
  }

  @Post(":id/upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: uploadFileSchema },
    ],
    response: baseResponse(uploadArticleFileResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  async uploadFileToArticle(
    @Param("id") id: string,
    @Body(new ValidateMultipartPipe(uploadFileSchema)) uploadFileBody: UploadFile,
    @UploadedFile("file") file: Express.Multer.File,
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
  @Validate({
    request: [{ type: "body", schema: previewArticleRequestSchema }],
    response: baseResponse(previewArticleResponseSchema),
  })
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
