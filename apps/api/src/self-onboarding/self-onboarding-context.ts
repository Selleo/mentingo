import { ServiceUnavailableException } from "@nestjs/common";

import version from "../../version.json";

// SemVer 2.0; numeric prerelease identifiers cannot have leading zeroes.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

/** Unknown development versions must not select tutorials for an unrelated release. */
export function resolveHelpdeskAppVersion(
  override?: string,
  bundledVersion = version.version,
): string {
  const appVersion = (override ?? bundledVersion).replace(/^v/, "");
  const match = appVersion.length <= 128 ? SEMVER.exec(appVersion) : null;
  if (!match || (match[1] === "0" && match[2] === "0" && match[3] === "0")) {
    throw new ServiceUnavailableException({
      message: "helpdesk.errors.versionUnavailable",
      retryable: false,
    });
  }
  return appVersion;
}
