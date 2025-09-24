import type { TFunction } from "i18next";

export const SORTABLE_FIELDS = ["title", "author", "category"] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];
export type SortOption = SortableField | `-${SortableField}` | "";

const FIELD_LABEL_KEYS: Record<SortableField, string> = {
  title: "studentCoursesView.availableCourses.headerOptions.title",
  author: "studentCoursesView.availableCourses.headerOptions.author",
  category: "studentCoursesView.availableCourses.headerOptions.category",
};

export const getFieldLabel = (
  field: SortableField,
  t: TFunction<"translation", undefined>,
): string => t(FIELD_LABEL_KEYS[field]);

export const createSortOption = (
  field: SortableField,
  order: "asc" | "desc",
  t: TFunction<"translation", undefined>,
): { value: SortOption; label: string } => ({
  value: order === "asc" ? field : `-${field}`,
  label: `${getFieldLabel(field, t)} ${order === "asc" ? "A-Z" : "Z-A"}`,
});

export const createSortOptions = (t: TFunction<"translation", undefined>) => {
  return SORTABLE_FIELDS.flatMap((field) => [
    createSortOption(field, "asc", t),
    createSortOption(field, "desc", t),
  ]);
};
