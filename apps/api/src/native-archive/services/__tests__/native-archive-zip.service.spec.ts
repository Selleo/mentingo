import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import archiver from "archiver";

import { NATIVE_ARCHIVE_FORMAT, NATIVE_ARCHIVE_KIND } from "../../native-archive.constants";
import { buildNativeArchive, readNativeArchive } from "../native-archive-zip.service";

import type { UUIDType } from "src/common";

const COURSE_ID = "f594d687-096b-4599-84bf-1f296afdb1e1" as UUIDType;

let temporaryDirectory: string;
let zipPath: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "mentingo-native-test-"));
  zipPath = path.join(temporaryDirectory, "archive.zip");
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

async function writeArchive(manifest: Record<string, unknown>) {
  const zip = archiver("zip");
  zip.append(JSON.stringify(manifest), { name: "manifest.json" });
  const output = createWriteStream(zipPath);
  zip.pipe(output);
  await Promise.all([
    zip.finalize(),
    new Promise<void>((resolve, reject) => {
      output.on("finish", resolve);
      output.on("error", reject);
    }),
  ]);
}

function validCourseManifest() {
  return {
    format: NATIVE_ARCHIVE_FORMAT,
    version: 1,
    kind: NATIVE_ARCHIVE_KIND.COURSE,
    rootId: COURSE_ID,
    courseIds: [COURSE_ID],
    exportedAt: new Date().toISOString(),
    applicationVersion: "test",
    assets: [],
  };
}

describe("native archive ZIP", () => {
  it("keeps distinct references when asset bytes are identical", async () => {
    const archive = await buildNativeArchive({
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId: COURSE_ID,
      courses: { [COURSE_ID]: { course: { id: COURSE_ID }, category: {} } },
      files: ["course/a.txt", "course/b.txt"].map((sourceReference) => ({
        path: sourceReference,
        sourceReference,
        contentType: "application/octet-stream",
        open: async () => Readable.from(Buffer.from("same bytes")),
      })),
    });

    try {
      await pipeline(archive.stream, createWriteStream(zipPath));
      const parsed = await readNativeArchive(zipPath);
      try {
        expect(parsed.manifest.assets.map((asset) => asset.sourceReference)).toEqual([
          "course/a.txt",
          "course/b.txt",
        ]);
        expect(parsed.assetFiles.size).toBe(1);
      } finally {
        await parsed.cleanup();
      }
    } finally {
      await archive.cleanup();
    }
  });

  it("rejects an unsupported archive version", async () => {
    await writeArchive({ ...validCourseManifest(), version: 999 });

    await expect(readNativeArchive(zipPath)).rejects.toThrow(
      "nativeArchive.error.unsupportedVersion",
    );
  });

  it.each([
    ["malformed root id", { rootId: "not-a-uuid" }],
    ["duplicate course ids", { courseIds: [COURSE_ID, COURSE_ID] }],
    ["course root mismatch", { courseIds: ["a6fdb420-cf54-4147-9ba7-1d34d6502400"] }],
    [
      "invalid asset metadata",
      {
        assets: [
          {
            path: "assets/not-a-hash",
            sha256: "not-a-hash",
            byteLength: -1,
            contentType: "text/plain",
            sourceReference: "course/resource",
          },
        ],
      },
    ],
    [
      "duplicate asset references",
      {
        assets: [
          {
            path: `assets/${"a".repeat(64)}`,
            sha256: "a".repeat(64),
            byteLength: 0,
            contentType: "application/octet-stream",
            sourceReference: "course/resource",
          },
          {
            path: `assets/${"b".repeat(64)}`,
            sha256: "b".repeat(64),
            byteLength: 0,
            contentType: "application/octet-stream",
            sourceReference: "course/resource",
          },
        ],
      },
    ],
  ])("rejects %s", async (_description, overrides) => {
    await writeArchive({ ...validCourseManifest(), ...overrides });

    await expect(readNativeArchive(zipPath)).rejects.toThrow("nativeArchive.error.invalidArchive");
  });
});
