import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { ExternalConversationsController } from "./external-conversations.controller";
import { ExternalTranscriptSignatureGuard } from "./external-transcript-signature.guard";

import type { McpResourceService } from "./mcp-resource.service";
import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

const keyPair = generateKeyPairSync("ed25519");
const publicKey = keyPair.publicKey.export({format: "der", type: "spki"}).toString("base64");
const resource = {url: "https://tenant.example/api/mcp", origin: "https://tenant.example", tenantId: "tenant"};
const rawBody = Buffer.from('{ "messages": ["hello"] }\n');
const now = 1800000000000;
const timestamp = String(now / 1000);
const signature = (body = rawBody, destination = `${resource.url}/external-conversations`, seconds = timestamp) => sign(null, Buffer.from([
  "mentingo-external-transcript-v1", "POST", destination, seconds, createHash("sha256").update(body).digest("hex"),
].join("\n")), keyPair.privateKey).toString("base64");
const makeRequest = () => ({method: "POST", rawBody, body: {messages: ["hello"]}, headers: {"x-mentingo-transcript-timestamp": timestamp, "x-mentingo-transcript-signature": signature()}, externalConversationResource: undefined as typeof resource | undefined});
const context = (request: unknown) => ({switchToHttp: () => ({getRequest: () => request})}) as ExecutionContext;
const resolver = {fromRequest: jest.fn(async () => resource)};
const guard = (key: string | undefined = publicKey) => new ExternalTranscriptSignatureGuard({get: () => key} as unknown as ConfigService, resolver as unknown as McpResourceService);

describe("External integration signatures", () => {
  beforeEach(() => {jest.spyOn(Date, "now").mockReturnValue(now); resolver.fromRequest.mockResolvedValue(resource);});
  afterEach(() => jest.restoreAllMocks());

  it("requires only the signature guard", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ExternalConversationsController.prototype.append)).toEqual([ExternalTranscriptSignatureGuard]);
  });

  it("accepts signed raw bytes without an OAuth token and attaches the active tenant", async () => {
    const request = makeRequest();
    expect(await guard().canActivate(context(request))).toBe(true);
    expect(request.externalConversationResource).toEqual(resource);
    request.body = {messages: ["parsed object not used"]};
    expect(await guard().canActivate(context(request))).toBe(true);
    request.rawBody = Buffer.from(JSON.stringify({messages: ["hello"]}));
    await expect(guard().canActivate(context(request))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects forwarding a signed transcript to a different tenant", async () => {
    resolver.fromRequest.mockResolvedValue({...resource, tenantId: "other", url: "https://other.example/api/mcp"});
    await expect(guard().canActivate(context(makeRequest()))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects inactive or unknown tenant hosts", async () => {
    resolver.fromRequest.mockRejectedValue(new UnauthorizedException());
    await expect(guard().canActivate(context(makeRequest()))).rejects.toThrow(UnauthorizedException);
  });

  it.each([-301, 301])("rejects timestamp outside the allowed window: %s", async offset => {
    const request = makeRequest();
    request.headers["x-mentingo-transcript-timestamp"] = String(Number(timestamp) + offset);
    request.headers["x-mentingo-transcript-signature"] = signature(rawBody, `${resource.url}/external-conversations`, request.headers["x-mentingo-transcript-timestamp"]);
    await expect(guard().canActivate(context(request))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects missing, malformed, wrong or unsupported verification keys", async () => {
    const other = generateKeyPairSync("ed25519").publicKey.export({format: "der", type: "spki"}).toString("base64");
    const rsa = generateKeyPairSync("rsa", {modulusLength: 2048}).publicKey.export({format: "der", type: "spki"}).toString("base64");
    for (const key of ["", "invalid!", Buffer.from("bad key").toString("base64"), other, rsa]) await expect(guard(key).canActivate(context(makeRequest()))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects missing raw bytes, malformed signatures and unsigned messages", async () => {
    const request = makeRequest(); Reflect.deleteProperty(request, "rawBody");
    await expect(guard().canActivate(context(request))).rejects.toThrow(UnauthorizedException);
    for (const value of ["", "invalid!", Buffer.from("short").toString("base64")]) {
      const invalid = makeRequest(); invalid.headers["x-mentingo-transcript-signature"] = value;
      await expect(guard().canActivate(context(invalid))).rejects.toThrow(UnauthorizedException);
    }
    const unsigned = makeRequest(); Reflect.deleteProperty(unsigned.headers, "x-mentingo-transcript-signature");
    await expect(guard().canActivate(context(unsigned))).rejects.toThrow(UnauthorizedException);
    const method = makeRequest(); method.method = "GET";
    await expect(guard().canActivate(context(method))).rejects.toThrow(UnauthorizedException);
  });
});
