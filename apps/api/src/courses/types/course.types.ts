import type { AnyPgColumn } from "drizzle-orm/pg-core";

export type CourseTranslationType = {
  id: string;
  base: string;
  field: AnyPgColumn;
  idColumn: AnyPgColumn;
};
