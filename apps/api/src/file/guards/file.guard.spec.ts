import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { FileGuard } from "./file.guard";

jest.mock("load-esm", () => ({
  loadEsm: jest.fn(async () => ({
    fileTypeFromBuffer: async () => ({ ext: "png", mime: "image/png" }),
  })),
}));

it("validates uploads in Jest with an ESM detector test double", async () => {
  const buffer = Buffer.from("upload bytes supplied to the detector");
  await expect(
    FileGuard.validateFile(
      {
        buffer,
        originalname: "image.png",
        mimetype: "image/png",
        size: buffer.length,
      } as Express.Multer.File,
      { allowedTypes: ["image/png"], maxSize: 1024 },
    ),
  ).resolves.toMatchObject({ type: { ext: "png", mime: "image/png" }, size: buffer.length });
});

// Native Node loads the actual ESM dependency without Jest VM flags or mocks.
const FILE_GUARD_PROBE = `
  const { FileGuard } = require("./src/file/guards/file.guard");
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
    "base64",
  );
  const file = {
    originalname: "image.png",
    mimetype: "image/png",
    buffer,
    size: buffer.length,
  };
  const options = { allowedTypes: ["image/png"], maxSize: 1024 };
  const rejectionMessage = async (operation) => {
    try {
      await operation();
      return null;
    } catch (error) {
      return error.message;
    }
  };
  (async () => {
    const detectedType = await FileGuard.getFileType(buffer);
    const validated = await FileGuard.validateFile(file, options);
    const mimeMismatch = await rejectionMessage(() =>
      FileGuard.validateFile({ ...file, mimetype: "image/jpeg" }, options),
    );
    const disallowedType = await rejectionMessage(() =>
      FileGuard.validateFile(file, { ...options, allowedTypes: ["image/jpeg"] }),
    );
    process.stdout.write(JSON.stringify({ detectedType, validated, mimeMismatch, disallowedType }));
  })().catch(error => { console.error(error); process.exitCode = 1; });
`;

describe("FileGuard with the installed file-type module", () => {
  let result: {
    detectedType: { ext: string; mime: string };
    validated: { type: { ext: string; mime: string }; size: number };
    mimeMismatch: string | null;
    disallowedType: string | null;
  };

  beforeAll(() => {
    result = JSON.parse(
      execFileSync(
        process.execPath,
        ["-r", require.resolve("ts-node/register/transpile-only"), "-e", FILE_GUARD_PROBE],
        { cwd: resolve(__dirname, "../../.."), encoding: "utf8", timeout: 15000 },
      ),
    );
  });

  it("detects and accepts actual PNG bytes using the application dependency", () => {
    expect(result.detectedType).toEqual({ ext: "png", mime: "image/png" });
    expect(result.validated.type).toEqual({ ext: "png", mime: "image/png" });
    expect(result.validated.size).toBe(68);
  });

  it("rejects a declared MIME type that differs from the detected bytes", () => {
    expect(result.mimeMismatch).toBe("files.toast.contentTypeMismatch");
  });

  it("rejects detected types outside the allowed list", () => {
    expect(result.disallowedType).toContain("File type image/png is not allowed");
  });
});
