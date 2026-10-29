import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { ExternalConversationsController } from "./external-conversations.controller";
import { ExternalTranscriptSignatureGuard } from "./external-transcript-signature.guard";
import { McpAuthGuard } from "./mcp-auth.guard";

import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

const keyPair = generateKeyPairSync("ed25519");
const publicKey = keyPair.publicKey.export({format: "der", type: "spki"}).toString("base64");
const resource = "https://tenant.example/api/mcp";
const token = "test-bearer-token";
const rawBody = Buffer.from('{ "messages": ["hello"] }\n', "utf8");
const now = 1800000000000;
const timestamp = String(now / 1000);
const signature = (body = rawBody, destination = `${resource}/external-conversations`, bearer = token, seconds = timestamp) => sign(null, Buffer.from([
  "mentingo-external-transcript-v1", "POST", destination, seconds,
  createHash("sha256").update(body).digest("hex"), createHash("sha256").update(bearer).digest("hex"),
].join("\n")), keyPair.privateKey).toString("base64");
const makeRequest = () => ({method: "POST", rawBody, body: {messages: ["hello"]}, mcpActor: {grant: {resource}}, headers: {authorization: `Bearer ${token}`, "x-mentingo-transcript-timestamp": timestamp, "x-mentingo-transcript-signature": signature()}});
const context = (request: unknown) => ({switchToHttp: () => ({getRequest: () => request})}) as ExecutionContext;
const guard = (key: string | undefined = publicKey) => new ExternalTranscriptSignatureGuard({get: () => key} as unknown as ConfigService);

describe("Slack bot transcript signatures", () => {
  beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(now); });
  afterEach(() => jest.restoreAllMocks());

  it("requires OAuth authentication before signature verification", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ExternalConversationsController.prototype.append)).toEqual([McpAuthGuard, ExternalTranscriptSignatureGuard]);
  });

  it("accepts a valid Ed25519 signature over the exact raw bytes", () => {
    expect(guard().canActivate(context(makeRequest()))).toBe(true);
    const request = makeRequest();
    request.body = {messages: ["parsed object is not used for verification"]};
    expect(guard().canActivate(context(request))).toBe(true);
    request.rawBody = Buffer.from(JSON.stringify({messages: ["hello"]}));
    expect(() => guard().canActivate(context(request))).toThrow(UnauthorizedException);
  });

  it("rejects body, destination, token and method tampering", () => {
    const body = makeRequest(); body.rawBody = Buffer.from("tampered");
    const destination = makeRequest(); destination.mcpActor.grant.resource = "https://other.example/api/mcp";
    const bearer = makeRequest(); bearer.headers.authorization = "Bearer other-token";
    const method = makeRequest(); method.method = "GET";
    for (const request of [body, destination, bearer, method]) expect(() => guard().canActivate(context(request))).toThrow(UnauthorizedException);
  });

  it.each([-301, 301])("rejects expired or future timestamps (%s seconds)", offset => {
    const request = makeRequest();
    request.headers["x-mentingo-transcript-timestamp"] = String(Number(timestamp) + offset);
    request.headers["x-mentingo-transcript-signature"] = signature(rawBody, `${resource}/external-conversations`, token, request.headers["x-mentingo-transcript-timestamp"]);
    expect(() => guard().canActivate(context(request))).toThrow(UnauthorizedException);
  });

  it("rejects missing, malformed, wrong and unsupported verification keys", () => {
    const otherKey = generateKeyPairSync("ed25519").publicKey.export({format: "der", type: "spki"}).toString("base64");
    const rsaKey = generateKeyPairSync("rsa", {modulusLength: 2048}).publicKey.export({format: "der", type: "spki"}).toString("base64");
    for (const key of ["", "bad-base64!", Buffer.from("not a key").toString("base64"), otherKey, rsaKey]) expect(() => guard(key).canActivate(context(makeRequest()))).toThrow(UnauthorizedException);
    expect(() => new ExternalTranscriptSignatureGuard({get: () => undefined} as unknown as ConfigService).canActivate(context(makeRequest()))).toThrow(UnauthorizedException);
  });

  it("rejects missing or malformed signature inputs", () => {
    for (const field of ["rawBody", "mcpActor"] as const) {
      const request = makeRequest(); Reflect.deleteProperty(request, field);
      expect(() => guard().canActivate(context(request))).toThrow(UnauthorizedException);
    }
    for (const field of ["authorization", "x-mentingo-transcript-timestamp", "x-mentingo-transcript-signature"]) {
      const request = makeRequest(); Reflect.deleteProperty(request.headers, field);
      expect(() => guard().canActivate(context(request))).toThrow(UnauthorizedException);
    }
    for (const value of ["invalid!", "", Buffer.from("short").toString("base64")]) {
      const request = makeRequest(); request.headers["x-mentingo-transcript-signature"] = value;
      expect(() => guard().canActivate(context(request))).toThrow(UnauthorizedException);
    }
    for (const value of ["abc", "1.2", "-1", "999999999999999999999"]) {
      const request = makeRequest(); request.headers["x-mentingo-transcript-timestamp"] = value;
      expect(() => guard().canActivate(context(request))).toThrow(UnauthorizedException);
    }
  });
});
