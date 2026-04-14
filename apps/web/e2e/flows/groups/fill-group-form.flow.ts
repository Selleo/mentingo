import { GROUP_FORM_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

type FillGroupFormFlowInput = {
  name?: string;
  characteristic?: string;
};

export const fillGroupFormFlow = async (
  page: Page,
  { name, characteristic }: FillGroupFormFlowInput,
) => {
  if (name !== undefined) {
    await page.getByTestId(GROUP_FORM_HANDLES.NAME_INPUT).fill(name);
  }

  if (characteristic !== undefined) {
    await page.getByTestId(GROUP_FORM_HANDLES.CHARACTERISTIC_INPUT).fill(characteristic);
  }
};
