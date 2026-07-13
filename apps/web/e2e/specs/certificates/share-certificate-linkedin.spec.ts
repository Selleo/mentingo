import { USER_ROLE } from "~/config/userRoles";

import { CERTIFICATES_HANDLES, CERTIFICATE_PREVIEW_HANDLES } from "../../data/certificates/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openProfileCertificatesFlow } from "../../flows/certificates/open-profile-certificates.flow";

import { createCertificatedCourseForStudent } from "./certificate-test-helpers";

test("student can generate a LinkedIn share link and the public share page is reachable", async ({
  cleanup,
  createWorkspaceContext,
  factories,
  withWorkerPage,
}) => {
  const { studentId, certificateId } = await createCertificatedCourseForStudent({
    cleanup,
    factories,
    prefix: `certificate-share-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await openProfileCertificatesFlow(page, studentId);
      await page.getByTestId(CERTIFICATES_HANDLES.card(certificateId)).click();
      await expect(page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.MODAL)).toBeVisible();

      const shareLinkResponse = page.waitForResponse((response) =>
        response.url().includes("/api/certificates/share-link"),
      );
      const popupPromise = page.waitForEvent("popup");

      await page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.SHARE_LINKEDIN_BUTTON).click();

      const response = await shareLinkResponse;
      expect(response.ok()).toBe(true);
      const { shareUrl, linkedinShareUrl } = await response.json();
      expect(shareUrl).toContain(certificateId);
      expect(linkedinShareUrl).toContain(encodeURIComponent(shareUrl));

      const popup = await popupPromise;
      expect(new URL(popup.url()).hostname).toBe("www.linkedin.com");
      await popup.close();

      const { context: anonymousContext } = await createWorkspaceContext({ root: true });
      try {
        const anonymousPage = await anonymousContext.newPage();
        const sharePagePath = `${new URL(shareUrl).pathname}${new URL(shareUrl).search}`;
        const sharePageResponse = await anonymousPage.goto(sharePagePath);
        expect(sharePageResponse?.ok()).toBe(true);

        const shareImagePath = sharePagePath.replace(
          "/certificates/share?",
          "/certificates/share-image?",
        );
        const shareImageResponse = await anonymousPage.goto(shareImagePath);
        expect(shareImageResponse?.ok()).toBe(true);
      } finally {
        await anonymousContext.close();
      }
    },
    { root: true },
  );
});
