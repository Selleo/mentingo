import { stripHtmlTags } from "@repo/shared";

export const formatHtmlString = (html: string) => stripHtmlTags(html).replace(/\s+/g, " ").trim();
