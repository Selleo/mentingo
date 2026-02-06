const DEFAULT_TENANT_ORIGIN =
  process.env.CORS_ORIGIN ||
  process.env.VITE_APP_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://localhost:5173";

export const getTenantEmail = (email: string, origin = DEFAULT_TENANT_ORIGIN) => {
  try {
    const hostname = new URL(origin).hostname;
    const suffix = hostname.split(".")[0] || hostname;
    const [local, domain] = email.split("@");
    if (!domain || !suffix || local.includes("+")) return email;
    return `${local}+${suffix}@${domain}`;
  } catch {
    return email;
  }
};
