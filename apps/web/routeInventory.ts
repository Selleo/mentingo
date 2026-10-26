import { defineRoutes } from "@remix-run/dev/dist/config/routes.js";
import { matchPath } from "react-router-dom";

import { routeAccessConfig } from "./app/config/routeAccessConfig";
import { routes } from "./routes";

import type { RouteManifest } from "@remix-run/dev/dist/config/routes.js";
import type { PermissionRequirement } from "@repo/shared";

export type RouteLeaf = {
  path: string;
  requiresSession: boolean;
  requirement: PermissionRequirement | undefined;
};

const SESSION_LAYOUT_FILE = "modules/Dashboard/UserDashboard.layout.tsx";

const loadRouteManifest = (): RouteManifest => {
  const manifest = routes(defineRoutes);
  if (manifest instanceof Promise) {
    throw new Error("routes() returned a Promise; the route inventory must be read synchronously");
  }
  return manifest;
};

const findRouteRequirement = (path: string) =>
  Object.entries(routeAccessConfig).find(([pattern]) =>
    matchPath({ path: pattern, end: true }, `/${path}`),
  )?.[1];

export const getRouteLeaves = (): RouteLeaf[] => {
  const manifest = loadRouteManifest();

  const entries = Object.values(manifest);
  const hasParent = (id: string) => {
    const { parentId } = manifest[id];
    return Boolean(parentId && manifest[parentId]);
  };

  const fullPath = (id: string): string => {
    const entry = manifest[id];
    const parentPath = hasParent(id) ? fullPath(entry.parentId!) : "";
    return [parentPath, entry.path].filter(Boolean).join("/");
  };

  const isInsideSessionLayout = (id: string): boolean =>
    manifest[id].file === SESSION_LAYOUT_FILE ||
    (hasParent(id) && isInsideSessionLayout(manifest[id].parentId!));

  const leaves = entries
    .filter((entry) => !entries.some((child) => child.parentId === entry.id))
    .map((entry) => {
      const path = fullPath(entry.id);
      return {
        path,
        requiresSession: isInsideSessionLayout(entry.id),
        requirement: findRouteRequirement(path),
      };
    });

  if (!leaves.length) throw new Error("The Remix route tree produced no leaf routes");

  return leaves;
};
