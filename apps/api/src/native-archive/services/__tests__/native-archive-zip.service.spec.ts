import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { pipeline } from "node:stream/promises";

import archiver from "archiver";
import unzipper from "unzipper";

import {
  NATIVE_ARCHIVE_FORMAT,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_LIMITS,
} from "../../native-archive.constants";
import { buildNativeArchive, readNativeArchive } from "../native-archive-zip.service";
import { verifyAssetDigests } from "../native-archive-zip.utils";

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
        expect(new Set(parsed.manifest.assets.map((asset) => asset.path)).size).toBe(1);
        expect((await buffer(parsed.openAsset(parsed.manifest.assets[0]!.path))).toString()).toBe(
          "same bytes",
        );
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

  it("aborts verification when streamed bytes exceed the ZIP declared entry size", async () => {
    const digest = "a".repeat(64);
    const assetPath = `assets/${digest}`;
    const stream = jest.fn(() => Readable.from([Buffer.from("payload is too large")]));
    const entriesByPath = new Map([[assetPath, { uncompressedSize: 4, stream } as never]]);
    const assets = [
      {
        path: assetPath,
        sha256: digest,
        byteLength: 4,
        contentType: "application/octet-stream",
        sourceReference: "course/resource",
      },
    ];

    await expect(verifyAssetDigests(assets, entriesByPath)).rejects.toThrow(
      "nativeArchive.error.assetTooLarge",
    );
    expect(stream).toHaveBeenCalledTimes(1);
    expect(await readdir(temporaryDirectory)).toEqual([]);
  });

  it("caps actual bytes verified across asset entries without writing any of them", async () => {
    const limit = jest.replaceProperty(NATIVE_ARCHIVE_LIMITS, "MAX_UNCOMPRESSED_BYTES", 12);

    try {
      const contents = [Buffer.from("first123"), Buffer.from("second45")];
      const assets = contents.map((content, index) => {
        const sha256 = createHash("sha256").update(content).digest("hex");
        return {
          path: `assets/${sha256}`,
          sha256,
          byteLength: content.length,
          contentType: "application/octet-stream",
          sourceReference: `course/resource-${index}`,
        };
      });
      const entriesByPath = new Map(
        assets.map((asset, index) => [
          asset.path,
          {
            uncompressedSize: asset.byteLength,
            stream: () => Readable.from([contents[index]!]),
          } as never,
        ]),
      );

      await expect(verifyAssetDigests(assets, entriesByPath)).rejects.toThrow(
        "nativeArchive.error.assetTooLarge",
      );
      expect(await readdir(temporaryDirectory)).toEqual([]);
    } finally {
      limit.restore();
    }
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

  async function writeBuiltArchive(fileContents: Record<string, string>) {
    const archive = await buildNativeArchive({
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId: COURSE_ID,
      courses: { [COURSE_ID]: { course: { id: COURSE_ID }, category: {} } },
      files: Object.entries(fileContents).map(([sourceReference, content]) => ({
        path: sourceReference,
        sourceReference,
        contentType: "application/octet-stream",
        open: async () => Readable.from(Buffer.from(content)),
      })),
    });

    try {
      await pipeline(archive.stream, createWriteStream(zipPath));
    } finally {
      await archive.cleanup();
    }
  }

  it("stores assets uncompressed and compresses the JSON documents", async () => {
    await writeBuiltArchive({ "course/video.mp4": "x".repeat(4096) });

    const { files } = await unzipper.Open.file(zipPath);
    const compressionMethodByKind = Object.fromEntries(
      files.map((file) => [
        file.path.startsWith("assets/") ? "asset" : file.path,
        file.compressionMethod,
      ]),
    );

    expect(compressionMethodByKind).toEqual({
      asset: 0,
      "manifest.json": 8,
      [`courses/${COURSE_ID}.json`]: 8,
    });
  });

  it("serves only manifest assets from an opened archive", async () => {
    await writeBuiltArchive({ "course/handout.pdf": "handout bytes" });
    const parsed = await readNativeArchive(zipPath);

    try {
      const [handout] = parsed.manifest.assets;

      expect((await buffer(parsed.openAsset(handout!.path))).toString()).toBe("handout bytes");
      expect(() => parsed.openAsset("manifest.json")).toThrow("nativeArchive.error.missingAsset");
    } finally {
      await parsed.cleanup();
    }
  });

  it("rejects an asset whose bytes do not match its manifest digest", async () => {
    const content = Buffer.from("tampered bytes");
    const declaredDigest = createHash("sha256").update("original bytes").digest("hex");
    const assets = [
      {
        path: `assets/${declaredDigest}`,
        sha256: declaredDigest,
        byteLength: content.length,
        contentType: "application/octet-stream",
        sourceReference: "course/resource",
      },
    ];
    const entriesByPath = new Map([
      [
        assets[0]!.path,
        { uncompressedSize: content.length, stream: () => Readable.from([content]) } as never,
      ],
    ]);

    await expect(verifyAssetDigests(assets, entriesByPath)).rejects.toThrow(
      "nativeArchive.error.invalidArchive",
    );
  });

  it("estimates the package size from each distinct asset and its documents", async () => {
    const courseDocument = { course: { id: COURSE_ID }, category: {} };
    const archive = await buildNativeArchive({
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId: COURSE_ID,
      courses: { [COURSE_ID]: courseDocument },
      files: ["course/a.txt", "course/b.txt", "course/c.txt"].map((sourceReference, index) => ({
        path: sourceReference,
        sourceReference,
        contentType: "application/octet-stream",
        open: async () => Readable.from(Buffer.from(index < 2 ? "same bytes" : "other")),
      })),
    });

    try {
      expect(archive.estimatedByteLength).toBe(
        "same bytes".length + "other".length + JSON.stringify(courseDocument).length,
      );
    } finally {
      archive.stream.destroy();
      await archive.cleanup();
    }
  });
});
