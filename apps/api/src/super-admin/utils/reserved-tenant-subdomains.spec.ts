import { isReservedTenantHost } from "./reserved-tenant-subdomains";

describe("isReservedTenantHost", () => {
  it("blocks hosts whose first label is reserved", () => {
    expect(isReservedTenantHost("https://scorm.mentingo.com", ["scorm", "api"])).toBe(true);
    expect(isReservedTenantHost("https://API.mentingo.com", ["scorm", "api"])).toBe(true);
  });

  it("allows hosts that only contain a reserved label deeper in the domain", () => {
    expect(isReservedTenantHost("https://academy.scorm.mentingo.com", ["scorm"])).toBe(false);
    expect(isReservedTenantHost("https://scorm-academy.mentingo.com", ["scorm"])).toBe(false);
  });

  it("allows every host when nothing is reserved", () => {
    expect(isReservedTenantHost("https://scorm.mentingo.com", [])).toBe(false);
  });
});
