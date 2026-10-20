import { get } from "lodash-es";
import { match, P } from "ts-pattern";

const TEST_API_BASE_URL = "http://localhost:3000";

/**
 * Picks the API URL from the build env, the server-injected `window.ENV`, or the Node env,
 * in that order. Test mode always targets the local API.
 */
export const resolveApiBaseUrl = () => {
  const importEnvMode = get(import.meta.env, "MODE") || undefined;
  const windowEnvApiUrl =
    get(typeof window !== "undefined" ? window : {}, "ENV.VITE_API_URL") || undefined;
  const importEnvApiUrl = import.meta.env.VITE_API_URL || undefined;
  const processEnvApiUrl =
    get(typeof process !== "undefined" ? process.env : {}, "VITE_API_URL") || undefined;

  const resolvedApiUrl = importEnvApiUrl || windowEnvApiUrl || processEnvApiUrl;

  return match({
    importEnvMode,
    resolvedApiUrl,
  })
    .with({ importEnvMode: "test" }, () => TEST_API_BASE_URL)
    .with({ resolvedApiUrl: P.string }, () => resolvedApiUrl)
    .otherwise(() => undefined);
};
