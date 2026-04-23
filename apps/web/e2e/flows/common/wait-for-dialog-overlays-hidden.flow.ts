import type { Page } from "@playwright/test";

export const waitForDialogOverlaysHiddenFlow = async (page: Page) => {
  await page.waitForFunction(() => {
    const overlays = [...document.querySelectorAll<HTMLElement>("div.fixed.inset-0.z-50")];

    return overlays.every((overlay) => {
      const style = window.getComputedStyle(overlay);
      const rect = overlay.getBoundingClientRect();

      return (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.pointerEvents === "none" ||
        rect.width === 0 ||
        rect.height === 0
      );
    });
  });
};
