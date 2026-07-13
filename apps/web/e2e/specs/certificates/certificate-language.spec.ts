import { USER_ROLE } from "~/config/userRoles";

import { CERTIFICATES_HANDLES, CERTIFICATE_PREVIEW_HANDLES } from "../../data/certificates/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openProfileCertificatesFlow } from "../../flows/certificates/open-profile-certificates.flow";

import { createCertificatedCourseForStudent } from "./certificate-test-helpers";

test("student can switch the certificate preview language", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const { studentId, certificateId } = await createCertificatedCourseForStudent({
    cleanup,
    factories,
    prefix: `certificate-language-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await openProfileCertificatesFlow(page, studentId);
      await page.getByTestId(CERTIFICATES_HANDLES.card(certificateId)).click();

      const modal = page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.MODAL);
      await expect(modal).toBeVisible();
      await expect(modal).toContainText("CERTIFICATE");

      await page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.LANGUAGE_SELECT).click();
      await page.getByRole("option", { name: "Polish" }).click();

      await expect(modal).toContainText("CERTYFIKAT");
    },
    { root: true },
  );
});
