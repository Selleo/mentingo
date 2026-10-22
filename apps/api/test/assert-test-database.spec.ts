import { assertSeparateTestDatabase } from "./assert-test-database";

describe("Destructive test database boundary", () => {
  it("rejects the application database even when the test uses another database role", () => {
    expect(() =>
      assertSeparateTestDatabase(
        "postgresql://app:password@localhost:5432/guidebook",
        "postgresql://postgres:password@localhost:5432/guidebook",
      ),
    ).toThrow("different database");
  });
  it("allows a separate test database", () => {
    expect(() =>
      assertSeparateTestDatabase(
        "postgresql://app:password@localhost:5432/guidebook",
        "postgresql://postgres:password@localhost:5432/guidebook_test",
      ),
    ).not.toThrow();
  });
  it.each([
    "postgresql://postgres:password@127.0.0.1/guidebook",
    "postgresql://postgres:password@[::1]:5432/guidebook",
    "postgresql://postgres:password@localhost:5432/%67uidebook",
  ])("rejects aliases and default ports for the application database", (url) => {
    expect(() =>
      assertSeparateTestDatabase("postgresql://app:password@localhost:5432/guidebook", url),
    ).toThrow("different database");
  });
});
