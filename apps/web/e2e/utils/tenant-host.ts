export const buildLmsLocalhostTenantHost = (baseURL: string, subdomain: string) => {
  const baseUrl = new URL(baseURL);
  const port = baseUrl.port ? `:${baseUrl.port}` : "";

  return `${baseUrl.protocol}//${subdomain}.9755.lms.localhost${port}`;
};

export const requireOrigin = (origin?: string) => {
  if (!origin) {
    throw new Error("Expected authenticated page fixture to provide an origin");
  }

  return origin;
};
