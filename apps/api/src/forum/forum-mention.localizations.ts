import { escape } from "lodash";

import type { SupportedLanguages } from "@repo/shared";

export function getLocalizedForumMentionContentAnnouncement(
  topicTitle: string,
): Record<SupportedLanguages, string> {
  const title = escape(topicTitle);

  return {
    en: `In the forum topic "${title}"`,
    pl: `W temacie na forum "${title}"`,
    de: `Im Forenthema "${title}"`,
    lt: `Forumo temoje "${title}"`,
    cs: `V tématu fóra "${title}"`,
    es: `En el tema del foro "${title}"`,
    fr: `Dans le sujet du forum « ${title} »`,
  };
}
