import type { SupportedLanguages } from "@repo/shared";

export function getLocalizedDiscussionReplyTitleAnnouncement(
  replyingUserFullName: string,
): Record<SupportedLanguages, string> {
  return {
    en: `${replyingUserFullName} replied in a discussion you take part in`,
    pl: `${replyingUserFullName} odpowiedział(a) w dyskusji, w której bierzesz udział`,
    de: `${replyingUserFullName} hat in einer Diskussion geantwortet, an der du teilnimmst`,
    lt: `${replyingUserFullName} atsakė diskusijoje, kurioje dalyvaujate`,
    cs: `${replyingUserFullName} odpověděl(a) v diskusi, které se účastníte`,
    es: `${replyingUserFullName} respondió en una discusión en la que participas`,
    fr: `${replyingUserFullName} a répondu dans une discussion à laquelle vous participez`,
  };
}
