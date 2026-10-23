import { defineRoutes } from "@remix-run/dev/dist/config/routes.js";
import { matchPath } from "react-router-dom";

import { routeAccessConfig } from "../../app/config/routeAccessConfig";
import { routes } from "../../routes";

import type { RouteManifest } from "@remix-run/dev/dist/config/routes.js";

const manifest = routes(defineRoutes) as RouteManifest;
const fullPath = (id: string): string => {
  const entry = manifest[id];
  const parent = entry.parentId && manifest[entry.parentId] ? fullPath(entry.parentId) : "";
  return [parent, entry.path].filter(Boolean).join("/");
};

const requiresSession = (id: string): boolean => {
  const entry = manifest[id];
  if (entry.file === "modules/Dashboard/UserDashboard.layout.tsx") return true;
  return Boolean(entry.parentId && manifest[entry.parentId] && requiresSession(entry.parentId));
};

export const protectedRoutes = Object.values(manifest)
  .filter((entry) => !Object.values(manifest).some((child) => child.parentId === entry.id))
  .flatMap((entry) => {
    const path = fullPath(entry.id);
    const rule = Object.entries(routeAccessConfig).find(([pattern]) =>
      matchPath({ path: pattern, end: true }, `/${path}`),
    );
    if (!rule || (!requiresSession(entry.id) && !rule[1].allOf?.length && !rule[1].anyOf?.length))
      return [];
    return [
      {
        path: `/${path.replace(/:[^/]+/g, "00000000-0000-4000-8000-000000000001")}`,
        requirement: rule[1],
      },
    ];
  });
