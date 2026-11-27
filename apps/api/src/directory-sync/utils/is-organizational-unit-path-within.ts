/** True when the path is the scope org unit itself or one of its sub-units. */
export function isOrganizationalUnitPathWithin(organizationalUnitPath: string, scopePath: string) {
  if (scopePath === "/") return true;

  return organizationalUnitPath === scopePath || organizationalUnitPath.startsWith(`${scopePath}/`);
}
