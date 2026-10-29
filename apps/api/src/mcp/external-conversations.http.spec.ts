import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { applyFormats } from "nestjs-typebox";
import request from "supertest";

import { ExternalConversationsController } from "./external-conversations.controller";
import { ExternalConversationsRepository } from "./external-conversations.repository";
import { ExternalTranscriptSignatureGuard } from "./external-transcript-signature.guard";
import { McpResourceService } from "./mcp-resource.service";

import type { INestApplication } from "@nestjs/common";

const pair = generateKeyPairSync("ed25519");
const origin = "https://tenant.example";
const payload = {
  integrationId: "slack-installation-1",
  source: "slack",
  threadKey: "thread",
  messages: [{ externalId: "1", role: "user", text: "Hello", createdAt: "2026-10-29T12:00:00Z" }],
};

describe("External transcript HTTP signature authentication", () => {
  let app: INestApplication;
  const append = jest.fn(async () => ({ id: "00000000-0000-4000-8000-000000000001" }));

  beforeAll(async () => {
    applyFormats();

    const module = await Test.createTestingModule({
      controllers: [ExternalConversationsController],
      providers: [
        ExternalTranscriptSignatureGuard,
        { provide: ExternalConversationsRepository, useValue: { append } },
        {
          provide: ConfigService,
          useValue: {
            get: () => pair.publicKey.export({ type: "spki", format: "der" }).toString("base64"),
          },
        },
        {
          provide: McpResourceService,
          useValue: {
            fromRequest: async (req: { headers: { host?: string } }) => {
              if (req.headers.host === "inactive.example") {
                throw new UnauthorizedException();
              }

              const destination =
                req.headers.host === "other.example" ? "https://other.example" : origin;

              return {
                tenantId: destination === origin ? "tenant-1" : "tenant-2",
                url: `${destination}/api/mcp`,
                origin: destination,
              };
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => append.mockClear());

  function headers(body: string) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(
      null,
      Buffer.from(
        [
          "mentingo-external-transcript-v1",
          "POST",
          `${origin}/api/mcp/external-conversations`,
          timestamp,
          createHash("sha256").update(body).digest("hex"),
        ].join("\n"),
      ),
      pair.privateKey,
    ).toString("base64");

    return {
      "Content-Type": "application/json",
      "X-Mentingo-Transcript-Timestamp": timestamp,
      "X-Mentingo-Transcript-Signature": signature,
      Host: "tenant.example",
    };
  }

  it("accepts signed HTTP bytes without Authorization and uses the verified tenant", async () => {
    const body = JSON.stringify(payload, null, 2);

    await request(app.getHttpServer())
      .post("/api/mcp/external-conversations")
      .set(headers(body))
      .send(body)
      .expect(201);

    expect(append).toHaveBeenCalledWith("tenant-1", payload);
  });

  it("rejects unsigned, tampered, inactive-tenant and forwarded requests", async () => {
    const body = JSON.stringify(payload);

    await request(app.getHttpServer())
      .post("/api/mcp/external-conversations")
      .send(payload)
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/mcp/external-conversations")
      .set(headers(body))
      .send(body.replace("Hello", "Changed"))
      .expect(401);

    for (const host of ["other.example", "inactive.example"]) {
      await request(app.getHttpServer())
        .post("/api/mcp/external-conversations")
        .set({ ...headers(body), Host: host })
        .send(body)
        .expect(401);
    }

    expect(append).not.toHaveBeenCalled();
  });
});
