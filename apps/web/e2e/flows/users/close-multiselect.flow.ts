import type { Locator, Page } from "@playwright/test";

type CloseMultiselectFlowInput = {
  closeTarget: Locator;
};

export const closeMultiselectFlow = async (
  page: Page,
  { closeTarget }: CloseMultiselectFlowInput,
) => {
  void page;
  await closeTarget.click({ position: { x: 8, y: 8 } });
};
