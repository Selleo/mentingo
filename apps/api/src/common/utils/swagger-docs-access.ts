import { UnauthorizedException, type INestApplication } from "@nestjs/common";

import { extractToken } from "src/utils/extract-token";

import type { JwtService } from "@nestjs/jwt";
import type { NextFunction, Request, Response } from "express";

export const SWAGGER_MAIN_ROUTE = "api";
export const SWAGGER_INTEGRATION_ROUTE = "api/integration";

export const DEV_ONLY_SWAGGER_ROUTE_MATCHERS = [/^\/api\/?$/];

export const AUTHENTICATED_SWAGGER_ROUTE_MATCHERS = [
  /^\/api\/integration\/?$/,
  /^\/api\/integration-json$/,
  /^\/api\/integration\/swagger-ui.*$/,
  /^\/api\/integration\/favicon-.*\.png$/,
];

type SwaggerDocsAccessOptions = {
  app: INestApplication;
  jwtService: JwtService;
  jwtSecret?: string;
  isDevelopment: boolean;
};

const getRequestPath = (request: Request) => request.originalUrl.split("?")[0].split("#")[0];

const matchesAnyRoute = (path: string, matchers: RegExp[]) =>
  matchers.some((matcher) => matcher.test(path));

export const registerSwaggerDocsAccessControl = ({
  app,
  jwtService,
  jwtSecret,
  isDevelopment,
}: SwaggerDocsAccessOptions) => {
  if (!isDevelopment) {
    app.use((request: Request, response: Response, next: NextFunction) => {
      const path = getRequestPath(request);
      const isDevOnlySwaggerRoute = matchesAnyRoute(path, DEV_ONLY_SWAGGER_ROUTE_MATCHERS);

      if (isDevOnlySwaggerRoute) {
        response.status(404).send("Not Found");
        return;
      }

      next();
    });
  }

  app.use(async (request: Request, _response: Response, next: NextFunction) => {
    const path = getRequestPath(request);
    const isProtectedSwaggerRoute = matchesAnyRoute(path, AUTHENTICATED_SWAGGER_ROUTE_MATCHERS);

    if (!isProtectedSwaggerRoute) {
      next();
      return;
    }

    const token = extractToken(request, "access_token");

    if (!token) {
      next(new UnauthorizedException("Access token not found"));
      return;
    }

    try {
      const payload = await jwtService.verifyAsync(token, { secret: jwtSecret });
      request["user"] = payload;
      next();
    } catch {
      next(new UnauthorizedException("Invalid access token"));
    }
  });
};
