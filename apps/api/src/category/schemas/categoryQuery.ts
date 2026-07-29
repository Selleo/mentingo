import { Type, type Static } from "@sinclair/typebox";

export const categorySortFields = ["title", "creationDate"] as const;

export const CategorySortFields: Record<CategorySortField, CategorySortField> = {
  title: "title",
  creationDate: "creationDate",
};

export type CategorySortField = (typeof categorySortFields)[number];

export const sortCategoryFieldsOptions = Type.Union([
  Type.Literal("title"),
  Type.Literal("creationDate"),
  Type.Literal("-title"),
  Type.Literal("-creationDate"),
]);

export type SortCategoryFieldsOptions = Static<typeof sortCategoryFieldsOptions>;

export const categoryFilterFiled = Type.Union([
  Type.Literal("title"),
  Type.Literal("creationDateRange"),
]);

export type CategoryFilterFiled = Static<typeof categoryFilterFiled>;

export const categoryFilterSchema = Type.Object({
  title: Type.Optional(Type.String()),
  state: Type.Optional(Type.String()),
  creationDateRange: Type.Optional(
    Type.Tuple([Type.String({ format: "date-time" }), Type.String({ format: "date-time" })]),
  ),
});

export type CategoryFilterSchema = Static<typeof categoryFilterSchema>;
