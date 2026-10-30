export function assertSeparateTestDatabase(applicationUrl: string, testUrl: string) {
  const application = new URL(applicationUrl);
  const test = new URL(testUrl);
  const host = (url: URL) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase().replace(/\.$/, ""))
      ? "loopback"
      : url.hostname.toLowerCase();
  if (
    host(application) === host(test) &&
    (application.port || "5432") === (test.port || "5432") &&
    decodeURIComponent(application.pathname) === decodeURIComponent(test.pathname)
  ) {
    throw new Error(
      "DATABASE_TEST_URL must target a different database from DATABASE_URL before destructive test setup.",
    );
  }
}
