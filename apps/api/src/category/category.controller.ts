import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  BaseResponse,
  paginatedResponse,
  PaginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { CategoryService } from "./category.service";
import {
  type AllCategoriesResponse,
  type CategorySchema,
  categorySchema,
  categoryLanguageSchema,
} from "./schemas/category.schema";
import { type SortCategoryFieldsOptions, sortCategoryFieldsOptions } from "./schemas/categoryQuery";
import { categoryCreateSchema, type CategoryInsert } from "./schemas/createCategorySchema";
import {
  type CategoryBaseLanguageUpdateBody,
  categoryBaseLanguageUpdateSchema,
  type CategoryUpdateBody,
  categoryUpdateSchema,
} from "./schemas/updateCategorySchema";

@Controller("category")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @Public()
  @Validate({
    response: paginatedResponse(Type.Array(categorySchema)),
    request: [
      { type: "query", name: "title", schema: Type.String() },
      { type: "query", name: "archived", schema: Type.String() },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "sort", schema: sortCategoryFieldsOptions },
      { type: "query", name: "language", schema: Type.Optional(categoryLanguageSchema) },
    ],
  })
  async getAllCategories(
    @Query("title") title: string,
    @Query("archived") archived: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: SortCategoryFieldsOptions,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser?: CurrentUserType,
  ): Promise<PaginatedResponse<AllCategoriesResponse>> {
    const filters = { archived, title };
    const query = { filters, language, page, perPage, sort };

    const data = await this.categoryService.getCategories(query, currentUser?.permissions);

    return new PaginatedResponse(data);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    response: baseResponse(categorySchema),
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(categoryLanguageSchema) },
    ],
  })
  async getCategoryById(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
  ): Promise<BaseResponse<CategorySchema>> {
    const category = await this.categoryService.getCategoryById(id, language);

    return new BaseResponse(category);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    request: [
      {
        type: "body",
        schema: categoryCreateSchema,
      },
    ],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createCategory(
    @Body() createCategoryBody: CategoryInsert,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.categoryService.createCategory(createCategoryBody, currentUser);

    return new BaseResponse({ id, message: "Category created" });
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    response: baseResponse(categorySchema),
    request: [
      { type: "param", name: "id", schema: Type.String() },
      { type: "body", schema: categoryUpdateSchema },
    ],
  })
  async updateCategory(
    @Param("id") id: UUIDType,
    @Body() updateCategoryBody: CategoryUpdateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CategorySchema>> {
    const category = await this.categoryService.updateCategory(id, updateCategoryBody, currentUser);

    return new BaseResponse(category);
  }

  @Post(":id/language")
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    response: baseResponse(categorySchema),
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: categoryLanguageSchema },
    ],
  })
  async createLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CategorySchema>> {
    const category = await this.categoryService.createLanguage(id, language, currentUser);

    return new BaseResponse(category);
  }

  @Delete(":id/language")
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    response: baseResponse(categorySchema),
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: categoryLanguageSchema },
    ],
  })
  async deleteLanguage(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CategorySchema>> {
    const category = await this.categoryService.deleteLanguage(id, language, currentUser);

    return new BaseResponse(category);
  }

  @Patch(":id/base-language")
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    response: baseResponse(categorySchema),
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: categoryBaseLanguageUpdateSchema },
    ],
  })
  async updateBaseLanguage(
    @Param("id") id: UUIDType,
    @Body() body: CategoryBaseLanguageUpdateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CategorySchema>> {
    const category = await this.categoryService.updateBaseLanguage(
      id,
      body.baseLanguage,
      currentUser,
    );

    return new BaseResponse(category);
  }

  @Delete("deleteCategory/:id")
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    response: baseResponse(Type.Object({ message: Type.String() })),
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
  })
  async deleteCategory(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.categoryService.deleteCategory(id, currentUser);

    return new BaseResponse({ message: "Category deleted successfully" });
  }

  @Delete("deleteManyCategories")
  @RequirePermission(PERMISSIONS.CATEGORY_MANAGE)
  @Validate({
    response: baseResponse(Type.Object({ message: Type.String() })),
    request: [{ type: "body", schema: Type.Array(UUIDSchema) }],
  })
  async deleteManyCategories(
    @Body() deleteCategoriesIds: string[],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.categoryService.deleteManyCategories(deleteCategoriesIds, currentUser);

    return new BaseResponse({ message: "Categories deleted successfully" });
  }
}
