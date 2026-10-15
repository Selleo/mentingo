/** Keep the editor's card sections aligned with the email renderer. */
export function getEmailTemplateLayoutSections(blocks: readonly { type: string }[]) {
  let footerStartIndex = blocks.length;

  while (footerStartIndex > 0 && blocks[footerStartIndex - 1].type === "footer") {
    footerStartIndex -= 1;
  }

  let headerEndIndex = 0;

  while (
    headerEndIndex < footerStartIndex &&
    (blocks[headerEndIndex].type === "header" || blocks[headerEndIndex].type === "heading")
  ) {
    headerEndIndex += 1;
  }

  return { headerEndIndex, footerStartIndex };
}

export const getEmailCardBackground = (primaryColor: string) =>
  `linear-gradient(to bottom, ${primaryColor} 0%, ${primaryColor} 50%, #fafafa 50%, #fafafa 100%)`;
