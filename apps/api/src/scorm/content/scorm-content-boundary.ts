import { resolveScormContentConfig } from "./scorm-content.config";

import type { Request, Response, NextFunction } from "express";

export function scormContentBoundary(env: NodeJS.ProcessEnv) {
  const origin = resolveScormContentConfig(env, "https://unused.lms.localhost").origin;
  const host = new URL(origin).host;
  return (req: Request, res: Response, next: NextFunction) => {
    const isContentHost = req.headers.host?.toLowerCase() === host;
    const isDeliveryRead =
      /^\/api\/scorm\/delivery\//u.test(req.path) &&
      (req.method === "GET" || req.method === "HEAD");
    if (isContentHost && !isDeliveryRead) return res.status(404).end();
    if (!isContentHost && req.path.startsWith("/api/scorm/delivery/")) return res.status(404).end();
    if (!isContentHost && req.path.startsWith("/api/") && req.headers.origin === origin)
      return res.status(403).end();
    if (isContentHost) {
      // Defense in depth; the dedicated proxy must also strip these headers.
      delete req.headers.cookie;
      delete req.headers.authorization;
      res.removeHeader("Set-Cookie");
    }
    next();
  };
}
