import type { SupportedLanguages } from "@repo/shared";

export function getLocalizedForumMentionContentAnnouncement(
  topicTitle: string,
): Record<SupportedLanguages, string> {
  return {
    en: `In the forum topic "${topicTitle}"`,
    pl: `W temacie na forum "${topicTitle}"`,
    de: `Im Forenthema "${topicTitle}"`,
    lt: `Forumo temoje "${topicTitle}"`,
    cs: `V tématu fóra "${topicTitle}"`,
    es: `En el tema del foro "${topicTitle}"`,
    fr: `Dans le sujet du forum « ${topicTitle} »`,
  };
}
