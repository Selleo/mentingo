/** Guard the disposable infrastructure before any helper can truncate test data. */
export function configureMcpHttpEnvironment(): void {
  const database = process.env.MCP_TEST_DATABASE_URL;
  const redis = process.env.MCP_TEST_REDIS_URL;
  const storage = process.env.MCP_TEST_S3_ENDPOINT;
  if (!database || !redis || !storage)
    throw new Error("MCP HTTP tests require explicit disposable database, Redis and S3 endpoints");
  const dbUrl = new URL(database);
  const redisUrl = new URL(redis);
  const storageUrl = new URL(storage);
  const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
  if (
    !loopback(dbUrl.hostname) ||
    !/^\/mcp_probe_[a-z0-9]+$/.test(dbUrl.pathname) ||
    dbUrl.port !== "15435" ||
    !loopback(redisUrl.hostname) ||
    redisUrl.port !== "16385" ||
    !loopback(storageUrl.hostname) ||
    storageUrl.port !== "19102"
  ) {
    throw new Error("MCP HTTP tests only support the dedicated loopback probe stack");
  }
  Object.assign(process.env, {
    NODE_ENV: "test",
    DISABLE_RATE_LIMITING: "true",
    DATABASE_URL: database,
    DATABASE_TEST_URL: database,
    LMS_DATABASE_URL: database,
    MIGRATOR_DATABASE_URL: database,
    REDIS_URL: redis,
    REDIS_TEST_URL: redis,
    S3_ENDPOINT: storage,
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "mcp_test_only",
    S3_SECRET_ACCESS_KEY: "mcp_test_storage_only",
    S3_BUCKET_NAME: "mcp-probe-local",
    AWS_REGION: "us-east-1",
    AWS_ACCESS_KEY_ID: "mcp_test_only",
    AWS_SECRET_ACCESS_KEY: "mcp_test_storage_only",
    AWS_BUCKET_NAME: "mcp-probe-local",
    JWT_SECRET: "mcp-http-test-only-secret",
    JWT_REFRESH_SECRET: "mcp-http-test-only-refresh",
    JWT_EXPIRATION_TIME: "1h",
    MASTER_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
    TEST_KEY: "mcp-http-test-only",
    CORS_ORIGIN: "https://tenant.local",
    DEV_TENANT_ORIGINS: "https://tenant.local,https://other-tenant.local",
    EMAIL_ADAPTER: "mailhog",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "9",
    SMTP_USER: "test",
    SMTP_PASSWORD: "test",
    SMTP_EMAIL_FROM: "test@example.test",
    GOOGLE_OAUTH_ENABLED: "false",
    MICROSOFT_OAUTH_ENABLED: "false",
    SLACK_OAUTH_ENABLED: "false",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    MICROSOFT_CLIENT_ID: "",
    MICROSOFT_CLIENT_SECRET: "",
    SLACK_CLIENT_ID: "",
    SLACK_CLIENT_SECRET: "",
    STRIPE_SECRET_KEY: "sk_test_mcp_only",
    STRIPE_PUBLISHABLE_KEY: "pk_test_mcp_only",
    STRIPE_WEBHOOK_SECRET: "test-only",
    BUNNY_STREAM_API_KEY: "test-only",
    BUNNY_STREAM_READ_ONLY_API_KEY: "test-only",
    BUNNY_STREAM_LIBRARY_ID: "0",
    BUNNY_STREAM_CDN_URL: "http://127.0.0.1:9",
    BUNNY_STREAM_TOKEN_SIGNING_KEY: "test-only",
    LIVEKIT_URL: "http://127.0.0.1:9",
    LIVEKIT_API_KEY: "test-only",
    LIVEKIT_API_SECRET: "mcp-http-test-only-livekit-secret",
    LUMA_BASE_URL: "http://127.0.0.1:9",
    LUMA_API_KEY: "test-only",
    OPENAI_API_KEY: "test-only",
    LANGFUSE_BASE_URL: "http://127.0.0.1:9",
    LANGFUSE_PUBLIC_KEY: "",
    LANGFUSE_SECRET_KEY: "",
    SENTRY_DSN: "",
    PHISHING_BASE_URL: "http://127.0.0.1:9",
    PHISHING_API_KEY: "",
    PHISHING_WEBHOOK_SECRET: "",
    ANALYTICS_SECRET: "test-only",
  });
}

configureMcpHttpEnvironment();
