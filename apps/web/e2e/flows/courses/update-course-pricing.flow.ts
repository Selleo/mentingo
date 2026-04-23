import { COURSE_PRICING_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

type UpdateCoursePricingFlowInput =
  | {
      isFree: true;
    }
  | {
      isFree: false;
      price: string;
    };

export const updateCoursePricingFlow = async (page: Page, input: UpdateCoursePricingFlowInput) => {
  if (input.isFree) {
    await page.getByTestId(COURSE_PRICING_HANDLES.FREE_CARD).click();
  } else {
    await page.getByTestId(COURSE_PRICING_HANDLES.PAID_CARD).click();
    await page.getByTestId(COURSE_PRICING_HANDLES.PRICE_INPUT).fill(input.price);
  }

  await page.getByTestId(COURSE_PRICING_HANDLES.SAVE_BUTTON).click();
};
