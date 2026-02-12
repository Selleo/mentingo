import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { and, count, eq, ilike, inArray, like } from "drizzle-orm";
import { isEqual } from "lodash";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { CreateCategoryEvent, DeleteCategoryEvent, UpdateCategoryEvent } from "src/events";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { categories, courses } from "src/storage/schema";
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
import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { Pagination, UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class CategoryService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

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

  public async createCategory(createCategoryBody: CategoryInsert, currentUser: CurrentUser) {
    const category = await this.db.query.categories.findFirst({
      where: ({ title }) => eq(title, createCategoryBody.title),
    });

    if (category) {
      throw new ConflictException("Category already exists");
    }

    const [newCategory] = await this.db.insert(categories).values(createCategoryBody).returning();

    if (!newCategory) throw new UnprocessableEntityException("Category not created");

    await this.outboxPublisher.publish(
      new CreateCategoryEvent({
        categoryId: newCategory.id,
        actor: currentUser,
        category: this.buildCategorySnapshot(newCategory),
      }),
    );

    return newCategory;
  }

  public async updateCategory(
    id: UUIDType,
    updateCategoryBody: CategoryUpdateBody,
    currentUser: CurrentUser,
  ) {
    const [existingCategory] = await this.db.select().from(categories).where(eq(categories.id, id));

    if (!existingCategory) {
      throw new NotFoundException("Category not found");
    }

    const previousSnapshot = this.buildCategorySnapshot(existingCategory);

    const [updatedCategory] = await this.db
      .update(categories)
      .set(updateCategoryBody)
      .where(eq(categories.id, id))
      .returning();

    if (updatedCategory) {
      const updatedSnapshot = this.buildCategorySnapshot(updatedCategory);

      if (!isEqual(previousSnapshot, updatedSnapshot)) {
        await this.outboxPublisher.publish(
          new UpdateCategoryEvent({
            categoryId: id,
            actor: currentUser,
            previousCategoryData: previousSnapshot,
            updatedCategoryData: updatedSnapshot,
          }),
        );
      }
    }

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

  async deleteCategory(id: UUIDType, currentUser: CurrentUser) {
    try {
      const [category] = await this.db.select().from(categories).where(eq(categories.id, id));

      if (!category) {
        throw new NotFoundException("Category not found");
      }

      const coursesWithCategory = await this.db
        .select({
          id: courses.id,
          title: this.localizationService.getLocalizedSqlField(courses.title),
        })
        .from(courses)
        .where(eq(courses.categoryId, id));

      if (coursesWithCategory.length > 0) {
        throw new UnprocessableEntityException(
          `Cannot delete category. It is assigned to ${
            coursesWithCategory.length
          } course(s): ${coursesWithCategory.map((c) => c.title).join(", ")}`,
        );
      }
      await this.db.delete(categories).where(eq(categories.id, id));

      await this.outboxPublisher.publish(
        new DeleteCategoryEvent({
          categoryId: category.id,
          actor: currentUser,
          categoryTitle: category.title,
        }),
      );
    } catch (error) {
      console.error(error);
      throw new NotFoundException("Category not found");
    }
  }

  async deleteManyCategories(categoryIds: string[], currentUser: CurrentUser): Promise<string> {
    let deletedCategories: { id: UUIDType; title: string }[] = [];

    const message = await this.db.transaction(async (tx) => {
      const existingCategories = await tx
        .select({ id: categories.id, title: categories.title })
        .from(categories)
        .where(inArray(categories.id, categoryIds));

      if (existingCategories.length === 0) {
        throw new NotFoundException("No categories found to delete");
      }

      const categoriesWithCourses = await tx
        .select({
          categoryId: courses.categoryId,
          courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
        })
        .from(courses)
        .where(
          inArray(
            courses.categoryId,
            existingCategories.map((cat) => cat.id),
          ),
        );

      if (categoriesWithCourses.length > 0) {
        const courseTitles = [...new Set(categoriesWithCourses.map((c) => c.courseTitle))];
        throw new UnprocessableEntityException(
          `Cannot delete categories. Some are assigned to courses: ${courseTitles.join(", ")}`,
        );
      }

      await tx.delete(categories).where(
        inArray(
          categories.id,
          existingCategories.map((cat) => cat.id),
        ),
      );

      deletedCategories = existingCategories.map((cat) => ({ id: cat.id, title: cat.title }));

      const deletedTitles = existingCategories.map((cat) => cat.title);
      return `Successfully deleted categories: ${deletedTitles.join(", ")}`;
    });

    await Promise.all(
      deletedCategories.map(({ id, title }) =>
        this.outboxPublisher.publish(
          new DeleteCategoryEvent({
            categoryId: id,
            actor: currentUser,
            categoryTitle: title,
          }),
        ),
      ),
    );

    return message;
  }

  private buildCategorySnapshot(category: {
    id: UUIDType;
    title?: string | null;
    archived?: boolean | null;
  }): CategoryActivityLogSnapshot {
    return {
      id: category.id,
      title: category.title,
      archived: category.archived,
    };
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
