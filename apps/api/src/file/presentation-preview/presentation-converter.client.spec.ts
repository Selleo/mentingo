import { createServer, type Server } from "node:http";

import { PresentationConverterClient } from "./presentation-converter.client";

const client = new PresentationConverterClient();
let server: Server;
let baseUrl: string;
let status = 200;
let body = "%PDF-1.4\nhello";
let requestBody = "";
let requestType = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    requestType = req.headers["content-type"] || "";
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      requestBody = Buffer.concat(chunks).toString();
      res.statusCode = status;
      if (status === 302) res.setHeader("Location", "http://127.0.0.1:1/redirect");
      res.end(body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Invalid test server address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  status = 200;
  body = "%PDF-1.4\nhello";
  process.env.PRESENTATION_CONVERTER_URL = `${baseUrl}/`;
});

afterAll(() => {
  delete process.env.PRESENTATION_CONVERTER_URL;
});

it("posts multipart bytes under files with a safe filename and returns PDF", async () => {
  await expect(client.convert(Buffer.from("untrusted presentation"), "pptx")).resolves.toEqual(
    Buffer.from(body),
  );
  expect(requestType).toContain("multipart/form-data");
  expect(requestBody).toContain('name="files"; filename="presentation.pptx"');
  expect(requestBody).toContain("untrusted presentation");
});

it("rejects redirects and non-PDF output with a generic error", async () => {
  status = 302;
  await expect(client.convert(Buffer.from("x"), "odp")).rejects.toThrow(
    "Presentation conversion failed",
  );
  status = 200;
  body = "private converter diagnostic";
  await expect(client.convert(Buffer.from("x"), "pptx")).rejects.toThrow(
    "Presentation conversion failed",
  );
});

it("requires an explicit URL in production", async () => {
  const original = process.env.NODE_ENV;
  delete process.env.PRESENTATION_CONVERTER_URL;
  process.env.NODE_ENV = "production";
  try {
    await expect(client.convert(Buffer.from("x"), "pptx")).rejects.toThrow(
      "Presentation conversion failed",
    );
  } finally {
    process.env.NODE_ENV = original;
  }
});
