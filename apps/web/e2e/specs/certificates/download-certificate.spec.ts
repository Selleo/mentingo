import { USER_ROLE } from "~/config/userRoles";

import { CERTIFICATES_HANDLES, CERTIFICATE_PREVIEW_HANDLES } from "../../data/certificates/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openProfileCertificatesFlow } from "../../flows/certificates/open-profile-certificates.flow";

import { createCertificatedCourseForStudent } from "./certificate-test-helpers";

test("student can download their certificate as a PDF", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const { studentId, certificateId } = await createCertificatedCourseForStudent({
    cleanup,
    factories,
    prefix: `certificate-download-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await openProfileCertificatesFlow(page, studentId);
      await page.getByTestId(CERTIFICATES_HANDLES.card(certificateId)).click();
      await expect(page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.MODAL)).toBeVisible();

      await page.route("**/api/certificates/download", async (route) => {
        await route.fulfill({
          body: Buffer.from("%PDF-1.4 fake certificate"),
          contentType: "application/pdf",
          headers: { "content-disposition": 'attachment; filename="certificate.pdf"' },
        });
      });

      const downloadResponse = page.waitForResponse((response) =>
        response.url().includes("/api/certificates/download"),
      );

      await page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.DOWNLOAD_BUTTON).click();

      const response = await downloadResponse;
      expect(response.ok()).toBe(true);
      const requestBody = response.request().postDataJSON();
      expect(requestBody).toMatchObject({ certificateId, language: "en" });

      await expect(page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.DOWNLOAD_BUTTON)).toBeEnabled();
    },
    { root: true },
  );
});
