import type { InferSelectModel } from "drizzle-orm";
import type { articles } from "src/storage/schema";

export type ArticleRecord = InferSelectModel<typeof articles>;
export type InitialArticleDraft = {
  title: string;
  summary: string;
  content: string;
};
