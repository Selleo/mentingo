/** Whether the tenant origin's first DNS label is one of the reserved subdomains. */
export function isReservedTenantHost(origin: string, reservedSubdomains: string[]): boolean {
  const [subdomain] = new URL(origin).hostname.split(".");

  return reservedSubdomains.includes(subdomain);
}
