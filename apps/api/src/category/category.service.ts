import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { and, count, eq, ilike, like } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { categories } from "src/storage/schema";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import {
  type CategoryFilterSchema,
  type CategorySortField,
  CategorySortFields,
} from "./schemas/categoryQuery";

import type { AllCategoriesResponse } from "./schemas/category.schema";
import type { CategoryQuery } from "./schemas/category.types";
import type { CategoryInsert } from "./schemas/createCategorySchema";
import type { CategoryUpdateBody } from "./schemas/updateCategorySchema";
import type { Pagination, UUIDType } from "src/common";

@Injectable()
export class CategoryService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getCategories(
    query: CategoryQuery,
    userRole?: UserRole,
  ): Promise<{
    data: AllCategoriesResponse;
    pagination: Pagination;
  }> {
    const {
      sort = CategorySortFields.title,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      filters = {},
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const isAdmin = userRole === USER_ROLES.ADMIN;

    const selectedColumns = {
      id: categories.id,
      archived: categories.archived,
      createdAt: categories.createdAt,
      title: categories.title,
    };

    return this.db.transaction(async (tx) => {
      const conditions = this.getFiltersConditions(filters);
      const queryDB = tx
        .select(selectedColumns)
        .from(categories)
        .where(and(...conditions))
        .orderBy(sortOrder(this.getColumnToSortBy(sortedField as CategorySortField, isAdmin)));

      const dynamicQuery = queryDB.$dynamic();

      const paginatedQuery = addPagination(dynamicQuery, page, perPage);

      const data = await paginatedQuery;

      const [{ totalItems }] = await tx
        .select({ totalItems: count() })
        .from(categories)
        .where(and(...conditions));

      return {
        data: this.serializeCategories(data, isAdmin),
        pagination: { totalItems: totalItems, page, perPage },
        appliedFilters: filters,
      };
    });
  }

  public async getCategoryById(id: UUIDType) {
    const [category] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id)));

    return category;
  }

  public async createCategory(createCategoryBody: CategoryInsert) {
    const [newCategory] = await this.db.insert(categories).values(createCategoryBody).returning();

    if (!newCategory) throw new UnprocessableEntityException("Category not created");

    return newCategory;
  }

  public async updateCategory(id: UUIDType, updateCategoryBody: CategoryUpdateBody) {
    const [existingCategory] = await this.db.select().from(categories).where(eq(categories.id, id));

    if (!existingCategory) {
      throw new NotFoundException("Category not found");
    }

    const [updatedCategory] = await this.db
      .update(categories)
      .set(updateCategoryBody)
      .where(eq(categories.id, id))
      .returning();

    return updatedCategory;
  }

  private createLikeFilter(filter: string) {
    return like(categories.title, `%${filter.toLowerCase()}%`);
  }

  private getColumnToSortBy(sort: CategorySortField, isAdmin: boolean) {
    if (!isAdmin) return categories.title;

    switch (sort) {
      case CategorySortFields.creationDate:
        return categories.createdAt;
      default:
        return categories.title;
    }
  }

  private serializeCategories = (data: AllCategoriesResponse, isAdmin: boolean) =>
    data.map((category) => ({
      ...category,
      archived: isAdmin ? category.archived : null,
      createdAt: isAdmin ? category.createdAt : null,
    }));

  private getFiltersConditions(filters: CategoryFilterSchema) {
    const conditions = [];
    if (filters.title) {
      conditions.push(ilike(categories.title, `%${filters.title.toLowerCase()}%`));
    }

    if (filters.archived) {
      conditions.push(eq(categories.archived, filters.archived === "true"));
    }

    return conditions ?? undefined;
  }
}
