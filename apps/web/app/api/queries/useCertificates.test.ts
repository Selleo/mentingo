import { certificateQueryOptions } from "./useCertificates";

describe("certificateQueryOptions", () => {
  const identifiers = { userId: "user-id", courseId: "course-id" };

  it("disables the request when certificate access is denied", () => {
    expect(certificateQueryOptions({ ...identifiers, enabled: false }).enabled).toBe(false);
  });

  it("enables the request when identifiers and permission are present", () => {
    expect(certificateQueryOptions({ ...identifiers, enabled: true }).enabled).toBe(true);
  });
});
