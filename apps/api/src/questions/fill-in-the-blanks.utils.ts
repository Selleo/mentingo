import { load as loadHtml } from "cheerio";

export const rewriteBlankAnswerIds = (content: string, optionMap: Map<string, string>) => {
  const $ = loadHtml(content, null, false);

  $("blank-answer-id").each((_, element) => {
    const sourceOptionId = $(element).text().trim();
    const targetOptionId = optionMap.get(sourceOptionId);

    if (targetOptionId) $(element).text(targetOptionId);
  });

  $("*").each((_, element) => {
    const tagName = (element as { tagName?: string }).tagName;
    const sourceOptionId = tagName?.match(/^blank-answer-([0-9a-f-]{36})$/i)?.[1];
    if (!sourceOptionId) return;

    const targetOptionId = optionMap.get(sourceOptionId);
    if (!targetOptionId) return;

    const innerHtml = $(element).html() ?? "";
    $(element).replaceWith(
      `<blank-answer-${targetOptionId}>${innerHtml}</blank-answer-${targetOptionId}>`,
    );
  });

  return $.html();
};
