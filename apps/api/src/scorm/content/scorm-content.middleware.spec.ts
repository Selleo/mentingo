import { UnauthorizedException } from "@nestjs/common";

import { ScormContentMiddleware } from "./scorm-content.middleware";

import type { ScormContentGrantsService } from "./scorm-content-grants.service";
import type { ScormContentGrantRequest } from "./scorm-content.types";
import type { Response } from "express";

const activeGrant = { actor: { userId: "learner-1" } };

const createMiddleware = (findActiveGrant = jest.fn().mockResolvedValue(activeGrant)) =>
  new ScormContentMiddleware({ findActiveGrant } as unknown as ScormContentGrantsService);

const contentRequest = (originalUrl: string) =>
  ({
    headers: { host: "scorm.lms.localhost" },
    originalUrl,
    method: "GET",
  }) as ScormContentGrantRequest;

describe("SCORM host boundary", () => {
  it.each([
    ["scorm.lms.localhost", "/api/auth/current-user", "GET", undefined, 404],
    ["scorm.lms.localhost", "/api/scorm/runtime/commit", "POST", undefined, 404],
    ["scorm.lms.localhost", "/", "GET", undefined, 404],
    ["scorm.lms.localhost", "/api/scorm/delivery/token/player", "POST", undefined, 404],
    ["app.lms.localhost", "/api/scorm/runtime/commit", "POST", "https://scorm.lms.localhost", 403],
  ])("blocks %s %s %s", async (host, originalUrl, method, origin, status) => {
    const next = jest.fn();
    const sendStatus = jest.fn();
    await createMiddleware().use(
      { headers: { host, origin }, originalUrl, method } as ScormContentGrantRequest,
      { sendStatus } as unknown as Response,
      next,
    );
    expect(sendStatus).toHaveBeenCalledWith(status);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the active grant before guards so rate limits track its owner", async () => {
    const next = jest.fn();
    const findActiveGrant = jest.fn().mockResolvedValue(activeGrant);
    const request = contentRequest("/api/scorm/delivery/token/assets/index.html?v=1");

    await createMiddleware(findActiveGrant).use(request, {} as Response, next);

    expect(findActiveGrant).toHaveBeenCalledWith("token");
    expect(request.scormGrant).toBe(activeGrant);
    expect(next).toHaveBeenCalled();
  });

  it("leaves invalid grants to the content guard", async () => {
    const next = jest.fn();
    const findActiveGrant = jest.fn().mockRejectedValue(new UnauthorizedException());
    const request = contentRequest("/api/scorm/delivery/expired/player");

    await createMiddleware(findActiveGrant).use(request, {} as Response, next);

    expect(request.scormGrant).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
