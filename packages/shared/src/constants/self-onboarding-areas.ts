import registry from "./self-onboarding-areas.json";

export const SELF_ONBOARDING_KEY_PATTERN = "^[a-z0-9][a-z0-9._-]{0,127}$";
const key = new RegExp(SELF_ONBOARDING_KEY_PATTERN);
const prefix = /^\/(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export type SelfOnboardingAreaRoute = { prefix: string; pageKey: string };
export type SelfOnboardingArea = {
  key: string;
  title: string;
  specPaths: string[];
  routes: SelfOnboardingAreaRoute[];
};
export type SelfOnboardingAreaRegistry = {
  schemaVersion: number;
  areas: SelfOnboardingArea[];
  excludedRoutes: { prefix: string; reason: string }[];
};

export function validateSelfOnboardingAreas(value: SelfOnboardingAreaRegistry): void {
  if (value.schemaVersion !== 1 || value.areas.length === 0) {
    throw new Error("Unsupported self-onboarding area registry");
  }
  const keys = new Set<string>();
  const prefixes = new Set<string>();
  const addPrefix = (path: string) => {
    if ((path !== "/" && !prefix.test(path)) || prefixes.has(path)) {
      throw new Error("Invalid or duplicate self-onboarding route prefix");
    }
    prefixes.add(path);
  };
  for (const area of value.areas) {
    if (
      !key.test(area.key) ||
      keys.has(area.key) ||
      !area.title.trim() ||
      area.routes.length === 0
    ) {
      throw new Error("Invalid or duplicate self-onboarding area");
    }
    keys.add(area.key);
    if (
      !area.specPaths.length ||
      area.specPaths.some((path) => !/^docs\/specs\/[a-z0-9-]+-business-spec\.md$/.test(path))
    ) {
      throw new Error("Invalid self-onboarding business specification path");
    }
    for (const route of area.routes) {
      if (!key.test(route.pageKey)) throw new Error("Invalid self-onboarding page key");
      addPrefix(route.prefix);
    }
  }
  for (const excluded of value.excludedRoutes) {
    if (!excluded.reason.trim()) throw new Error("A route exclusion requires an explanation");
    addPrefix(excluded.prefix);
  }
}

validateSelfOnboardingAreas(registry);
export const SELF_ONBOARDING_AREAS: readonly SelfOnboardingArea[] = registry.areas;
export const SELF_ONBOARDING_EXCLUDED_ROUTES = registry.excludedRoutes;

function matches(path: string, routePrefix: string): boolean {
  if (routePrefix === "/") return path === "/";
  return path === routePrefix || path.startsWith(`${routePrefix}/`);
}

/** Resolve a symbolic page key locally; resource IDs, query strings and tenant URLs never leave this helper. */
export function getSelfOnboardingPageKey(pathname: string): string | undefined {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\"))
    return undefined;
  const path = pathname.split(/[?#]/, 1)[0];
  if (SELF_ONBOARDING_EXCLUDED_ROUTES.some((route) => matches(path, route.prefix)))
    return undefined;
  let selected: SelfOnboardingAreaRoute | undefined;
  for (const area of SELF_ONBOARDING_AREAS) {
    for (const route of area.routes) {
      if (
        matches(path, route.prefix) &&
        (!selected || route.prefix.length > selected.prefix.length)
      ) {
        selected = route;
      }
    }
  }
  return selected?.pageKey;
}

export function getSelfOnboardingAreaTitle(domain: string): string {
  const area = SELF_ONBOARDING_AREAS.find((candidate) => candidate.key === domain);
  if (area) return area.title;
  return domain
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
