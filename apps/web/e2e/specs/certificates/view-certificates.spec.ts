import { USER_ROLE } from "~/config/userRoles";

import { CERTIFICATES_HANDLES } from "../../data/certificates/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openProfileCertificatesFlow } from "../../flows/certificates/open-profile-certificates.flow";

import { createCertificatedCourseForStudent } from "./certificate-test-helpers";

test("student sees a certificate for a completed course on their profile", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const { studentId, certificateId } = await createCertificatedCourseForStudent({
    cleanup,
    factories,
    prefix: `certificate-view-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await openProfileCertificatesFlow(page, studentId);

      const card = page.getByTestId(CERTIFICATES_HANDLES.card(certificateId));
      await expect(card).toBeVisible();
    },
    { root: true },
  );
});
