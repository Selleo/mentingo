export const buildLmsLocalhostTenantHost = (baseURL: string, subdomain: string) => {
  const baseUrl = new URL(baseURL);
  const port = baseUrl.port ? `:${baseUrl.port}` : "";

  return `${baseUrl.protocol}//${subdomain}.lms.localhost${port}`;
};
