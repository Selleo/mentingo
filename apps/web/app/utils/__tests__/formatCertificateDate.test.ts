import { formatCertificateDate } from "../formatCertificateDate";

describe("formatCertificateDate", () => {
  it("formats ISO dates", () => {
    expect(formatCertificateDate("2026-05-18T10:30:00.000Z")).toBe("18.05.2026");
  });

  it("keeps already formatted certificate dates", () => {
    expect(formatCertificateDate("18.05.2026")).toBe("18.05.2026");
  });

  it("returns an empty string for missing and invalid dates", () => {
    expect(formatCertificateDate(null)).toBe("");
    expect(formatCertificateDate("")).toBe("");
    expect(formatCertificateDate("not-a-date")).toBe("");
  });
});
