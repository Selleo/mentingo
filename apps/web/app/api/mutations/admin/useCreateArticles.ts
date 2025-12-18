import { useCreateArticle } from "./useCreateArticle";
import { useCreateArticleSection } from "./useCreateArticleSection";

export function useCreateArticles() {
  const createArticle = useCreateArticle();
  const createArticleSection = useCreateArticleSection();

  return { createArticle, createArticleSection };
}
