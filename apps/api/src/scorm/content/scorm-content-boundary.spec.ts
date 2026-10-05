import { scormContentBoundary } from "./scorm-content-boundary";

const boundary = scormContentBoundary({
  NODE_ENV: "test",
  SCORM_CONTENT_ORIGIN: "https://scorm.example",
});
function check(host: string, path: string, method = "GET", origin?: string) {
  const req = {
    headers: {
      host,
      origin,
      cookie: "secret" as string | undefined,
      authorization: "Bearer secret" as string | undefined,
    },
    path,
    method,
  };
  const res = { status: jest.fn().mockReturnThis(), end: jest.fn(), removeHeader: jest.fn() };
  const next = jest.fn();
  boundary(req as never, res as never, next);
  return { req, res, next };
}

describe("SCORM content host boundary", () => {
  it("rejects ordinary API and non-read delivery on the isolated host", () => {
    expect(check("scorm.example", "/api/auth/session").res.status).toHaveBeenCalledWith(404);
    expect(
      check("scorm.example", "/api/scorm/delivery/token/player", "POST").res.status,
    ).toHaveBeenCalledWith(404);
  });
  it("strips credentials for delivery and rejects LMS-host delivery", () => {
    const delivered = check("scorm.example", "/api/scorm/delivery/token/player");
    expect(delivered.next).toHaveBeenCalled();
    expect(delivered.req.headers.cookie).toBeUndefined();
    expect(delivered.req.headers.authorization).toBeUndefined();
    expect(
      check("lms.example", "/api/scorm/delivery/token/player").res.status,
    ).toHaveBeenCalledWith(404);
  });
  it("blocks content-origin requests to ordinary LMS APIs", () => {
    expect(
      check("lms.example", "/api/user", "GET", "https://scorm.example").res.status,
    ).toHaveBeenCalledWith(403);
  });
});
