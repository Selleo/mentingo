import { SCORM_TOKEN_PATTERN } from "@repo/shared";

export function parseScormLaunch(value: string, lmsOrigin: string) {
  try {
    const url = new URL(value);
    const match = /^\/api\/scorm\/delivery\/([a-f0-9]{64})\/player$/u.exec(url.pathname);
    if (
      url.protocol !== "https:" ||
      url.origin === lmsOrigin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !match ||
      !SCORM_TOKEN_PATTERN.test(match[1])
    )
      return null;
    return { origin: url.origin, channel: match[1] };
  } catch {
    return null;
  }
}
