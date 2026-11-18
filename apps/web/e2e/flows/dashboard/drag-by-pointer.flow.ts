import type { Locator, Page } from "@playwright/test";

const centerOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Drag handle is not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Drags with intermediate pointer moves, so dnd-kit's pointer sensor activates reliably. */
export const dragByPointerFlow = async (page: Page, source: Locator, target: Locator) => {
  const from = await centerOf(source);
  const to = await centerOf(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};
