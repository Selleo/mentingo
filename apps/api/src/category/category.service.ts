import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PERMISSIONS, type PermissionKey, type SupportedLanguages } from "@repo/shared";
import { and, count, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import { isEqual } from "lodash";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { buildJsonbField, deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { hasPermission } from "src/common/permissions/permission.utils";
import { CreateCategoryEvent, DeleteCategoryEvent, UpdateCategoryEvent } from "src/events";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { categories, courses } from "src/storage/schema";
import { hasDataToUpdate } from "src/utils/hasDataToUpdate";

import {
  type CategoryFilterSchema,
  type CategorySortField,
  CategorySortFields,
} from "./schemas/categoryQuery";

import type { AllCategoriesResponse } from "./schemas/category.schema";
import type { CategoryQuery, CategoryRecord } from "./schemas/category.types";
import type { CategoryInsert } from "./schemas/createCategorySchema";
import type { CategoryUpdateBody } from "./schemas/updateCategorySchema";
import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { Pagination, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CategoryService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  public async getCategories(
    query: CategoryQuery,
    userPermissions?: PermissionKey[],
  ): Promise<{
    data: AllCategoriesResponse;
    pagination: Pagination;
  }> {
    const {
      sort = CategorySortFields.title,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      filters = {},
      language,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const canManageCategories = hasPermission(userPermissions, PERMISSIONS.CATEGORY_MANAGE);

    return this.db.transaction(async (tx) => {
      const conditions = this.getFiltersConditions(filters, language);

      const queryDB = tx
        .select({
          ...getTableColumns(categories),
          archived: sql<boolean | null>`
            CASE WHEN ${canManageCategories} = TRUE THEN ${categories.archived} ELSE NULL END
          `,
          createdAt: sql<string | null>`
            CASE WHEN ${canManageCategories} = TRUE THEN ${categories.createdAt} ELSE NULL END
          `,
          title: this.getLocalizedCategoryTitle(language),
        })
        .from(categories)
        .where(and(...conditions))
        .orderBy(
          sortOrder(
            this.getColumnToSortBy(sortedField as CategorySortField, canManageCategories, language),
          ),
        );

      const dynamicQuery = queryDB.$dynamic();
      const paginatedQuery = addPagination(dynamicQuery, page, perPage);

      const data = await paginatedQuery;

      const [{ totalItems }] = await tx
        .select({ totalItems: count() })
        .from(categories)
        .where(and(...conditions));

      return {
        data,
        pagination: { totalItems: totalItems, page, perPage },
        appliedFilters: filters,
      };
    });
  }

  public async getCategoryById(id: UUIDType, language?: SupportedLanguages) {
    const [category] = await this.db
      .select({
        ...getTableColumns(categories),
        title: this.getLocalizedCategoryTitle(language),
      })
      .from(categories)
      .where(eq(categories.id, id));

    if (!category) {
      throw new NotFoundException({ message: "adminCategoryView.error.categoryNotFound" });
    }

    return category;
  }

  public async createCategory(createCategoryBody: CategoryInsert, currentUser: CurrentUserType) {
    const { language } = createCategoryBody;

    const category = await this.findCategoryByBaseTitle(createCategoryBody.title);

    if (category) {
      throw new ConflictException({ message: "adminCategoryView.toast.alreadyExists" });
    }

    const [newCategory] = await this.db
      .insert(categories)
      .values({
        title: buildJsonbField(language, createCategoryBody.title),
        baseLanguage: language,
        availableLocales: [language],
      })
      .returning();

    if (!newCategory) {
      throw new UnprocessableEntityException({
        message: "adminCategoryView.toast.categoryNotCreated",
      });
    }

    await this.outboxPublisher.publish(
      new CreateCategoryEvent({
        categoryId: newCategory.id,
        actor: currentUser,
        category: await this.getCategorySnapshot(newCategory.id, language),
      }),
    );

    return this.getCategoryById(newCategory.id, language);
  }

  public async updateCategory(
    id: UUIDType,
    updateCategoryBody: CategoryUpdateBody,
    currentUser: CurrentUserType,
  ) {
    const existingCategory = await this.getCategoryById(id);

    const language = updateCategoryBody.language ?? existingCategory.baseLanguage;

    if (updateCategoryBody.title !== undefined) {
      if (!existingCategory.availableLocales.includes(language)) {
        throw new BadRequestException({
          message: "adminCategoryView.toast.languageNotSupported",
        });
      }

      if (language === existingCategory.baseLanguage) {
        const categoryWithTitle = await this.findCategoryByBaseTitle(updateCategoryBody.title, id);
        if (categoryWithTitle) {
          throw new ConflictException({
            message: "adminCategoryView.toast.alreadyExists",
          });
        }
      }
    }

    const previousSnapshot = await this.getCategorySnapshot(id, language);

    const updateData: {
      archived?: boolean;
      title?: ReturnType<typeof setJsonbField>;
    } = {};

    if (updateCategoryBody.archived !== undefined) {
      updateData.archived = updateCategoryBody.archived;
    }

    if (updateCategoryBody.title !== undefined) {
      const titleUpdate = setJsonbField(categories.title, language, updateCategoryBody.title);

      if (titleUpdate) updateData.title = titleUpdate;
    }

    if (!hasDataToUpdate(updateData)) {
      return this.getCategoryById(id, language);
    }

    const [updatedCategory] = await this.db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning();

    if (updatedCategory) {
      await this.publishUpdateEvent(id, currentUser, previousSnapshot, updatedCategory, language);
    }

    return this.getCategoryById(id, language);
  }

  async createLanguage(id: UUIDType, language: SupportedLanguages, currentUser: CurrentUserType) {
    const category = await this.getCategoryById(id, language);

    if (category.availableLocales.includes(language)) {
      throw new BadRequestException({
        message: "adminCategoryView.toast.languageAlreadyExists",
      });
    }

    const previousSnapshot = await this.getCategorySnapshot(id, language);

    const [updatedCategory] = await this.db
      .update(categories)
      .set({ availableLocales: [...category.availableLocales, language] })
      .where(eq(categories.id, id))
      .returning();

    if (updatedCategory) {
      await this.publishUpdateEvent(id, currentUser, previousSnapshot, updatedCategory, language);
    }

    return this.getCategoryById(id, language);
  }

  async deleteLanguage(id: UUIDType, language: SupportedLanguages, currentUser: CurrentUserType) {
    const category = await this.getCategoryById(id, language);

    if (!category.availableLocales.includes(language) || category.baseLanguage === language) {
      throw new BadRequestException({
        message: "adminCategoryView.toast.invalidLanguageToDelete",
      });
    }

    const previousSnapshot = await this.getCategorySnapshot(id, language);

    const [updatedCategory] = await this.db
      .update(categories)
      .set({
        title: deleteJsonbField(categories.title, language),
        availableLocales: sql`ARRAY_REMOVE(${categories.availableLocales}, ${language})`,
      })
      .where(eq(categories.id, id))
      .returning();

    if (updatedCategory) {
      await this.publishUpdateEvent(id, currentUser, previousSnapshot, updatedCategory, language);
    }

    return this.getCategoryById(id, category.baseLanguage);
  }

  async updateBaseLanguage(
    id: UUIDType,
    baseLanguage: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    const category = await this.getCategoryById(id, baseLanguage);

    if (!category.availableLocales.includes(baseLanguage)) {
      throw new BadRequestException({ message: "adminCategoryView.toast.languageNotSupported" });
    }

    if (!category.title) {
      throw new BadRequestException({
        message: "adminCategoryView.toast.baseLanguageTitleRequired",
      });
    }

    const categoryWithTitle = await this.findCategoryByBaseTitle(category.title, id);

    if (categoryWithTitle) {
      throw new ConflictException({ message: "adminCategoryView.toast.alreadyExists" });
    }

    const previousSnapshot = await this.getCategorySnapshot(id, category.baseLanguage);

    const [updatedCategory] = await this.db
      .update(categories)
      .set({ baseLanguage })
      .where(eq(categories.id, id))
      .returning();

    if (updatedCategory) {
      await this.publishUpdateEvent(
        id,
        currentUser,
        previousSnapshot,
        updatedCategory,
        baseLanguage,
      );
    }

    return this.getCategoryById(id, baseLanguage);
  }

  private getColumnToSortBy(
    sort: CategorySortField,
    isAdmin: boolean,
    language?: SupportedLanguages,
  ) {
    if (!isAdmin) return this.getLocalizedCategoryTitle(language);

    switch (sort) {
      case CategorySortFields.creationDate:
        return categories.createdAt;
      default:
        return this.getLocalizedCategoryTitle(language);
    }
  }

  async deleteCategory(id: UUIDType, currentUser: CurrentUserType) {
    const category = await this.getCategoryById(id);

    const coursesWithCategory = await this.db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(courses)
      .where(eq(courses.categoryId, id));

    if (coursesWithCategory.length > 0) {
      throw new UnprocessableEntityException(
        this.getCategoryAssignedToCoursesError(coursesWithCategory.map((course) => course.title)),
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
  }

  async deleteManyCategories(categoryIds: string[], currentUser: CurrentUserType): Promise<string> {
    let deletedCategories: { id: UUIDType; title: string }[] = [];

    const message = await this.db.transaction(async (tx) => {
      const existingCategories = await tx
        .select({ id: categories.id, title: this.getLocalizedCategoryTitle() })
        .from(categories)
        .where(inArray(categories.id, categoryIds));

      if (existingCategories.length === 0) {
        throw new NotFoundException({
          message: "adminCategoriesView.toast.noCategoriesFoundToDelete",
        });
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
          this.getCategoryAssignedToCoursesError(courseTitles),
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

  private async getCategorySnapshot(categoryId: UUIDType, language?: SupportedLanguages) {
    const { id, title, archived } = await this.getCategoryById(categoryId, language);

    return {
      id,
      title,
      archived,
    };
  }

  private getFiltersConditions(filters: CategoryFilterSchema, language?: SupportedLanguages) {
    const conditions = [];

    if (filters.title) {
      conditions.push(
        sql`${this.getLocalizedCategoryTitle(language)} ilike ${`%${filters.title}%`}`,
      );
    }

    if (filters.archived) {
      conditions.push(eq(categories.archived, filters.archived === "true"));
    }

    return conditions;
  }

  private getLocalizedCategoryTitle(language?: SupportedLanguages) {
    return this.localizationService.getLocalizedSqlField(categories.title, language, categories);
  }

  private getCategoryAssignedToCoursesError(courseTitles: string[]) {
    return {
      message: "adminCategoriesView.toast.deleteCategoryAssignedToCourses",
      translationParams: {
        courseCount: courseTitles.length,
        courseTitles: courseTitles.join(", "),
      },
    };
  }

  private async findCategoryByBaseTitle(title: string, excludeCategoryId?: UUIDType) {
    const conditions = [sql`${this.getLocalizedCategoryTitle()} = ${title}`];

    if (excludeCategoryId) conditions.push(ne(categories.id, excludeCategoryId));

    const [category] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(...conditions))
      .limit(1);

    return category;
  }

  private async publishUpdateEvent(
    categoryId: UUIDType,
    currentUser: CurrentUserType,
    previousSnapshot: CategoryActivityLogSnapshot,
    updatedCategory: Pick<CategoryRecord, "id">,
    language: SupportedLanguages,
  ) {
    const updatedSnapshot = await this.getCategorySnapshot(updatedCategory.id, language);

    if (!isEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new UpdateCategoryEvent({
          categoryId,
          actor: currentUser,
          previousCategoryData: previousSnapshot,
          updatedCategoryData: updatedSnapshot,
        }),
      );
    }
  }
}
