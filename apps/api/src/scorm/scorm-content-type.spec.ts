import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Native Node loads the actual ESM dependency without Jest VM flags or mocks.
const SCORM_CONTENT_TYPE_PROBE = `
  const { resolveScormContentType } = require("./src/scorm/scorm-content-type");
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
    "base64",
  );
  (async () => {
    const detected = await resolveScormContentType(buffer, "image.jpg");
    const fromFilename = await resolveScormContentType(Buffer.from("<html></html>"), "index.html");
    const fallback = await resolveScormContentType(Buffer.from("plain text"), "unknown");
    process.stdout.write(JSON.stringify({ detected, fromFilename, fallback }));
  })().catch(error => { console.error(error); process.exitCode = 1; });
`;

describe("resolveScormContentType with the installed file-type module", () => {
  let result: { detected: string; fromFilename: string; fallback: string };

  beforeAll(() => {
    result = JSON.parse(
      execFileSync(
        process.execPath,
        ["-r", require.resolve("ts-node/register/transpile-only"), "-e", SCORM_CONTENT_TYPE_PROBE],
        { cwd: resolve(__dirname, "../.."), encoding: "utf8", timeout: 15000 },
      ),
    );
  });

  it("uses detected bytes before the filename MIME type", () => {
    expect(result.detected).toBe("image/png");
  });

  it("falls back to the filename for text assets", () => {
    expect(result.fromFilename).toBe("text/html");
  });

  it("uses the default when neither bytes nor filename identify the type", () => {
    expect(result.fallback).toBe("application/octet-stream");
  });
});
