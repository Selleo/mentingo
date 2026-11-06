import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { RESOURCE_VISIBILITY } from "@repo/shared";

import { FileGuard } from "src/file/guards/file.guard";

import { NATIVE_ARCHIVE_LIMITS } from "../../native-archive.constants";
import { NativeArchiveAssetsService } from "../native-archive-assets.service";

import type { ParsedNativeArchive } from "../../native-archive.types";
import type { UUIDType } from "src/common";
import type { SourceSnapshot } from "src/course-transfer/types/course-transfer-graph.types";

const TENANT_ID = "1c720b6d-390d-4613-aa75-a5cc0b642147" as UUIDType;
const IMAGE_FILE_KEY = `${TENANT_ID}/course/native-archive/variants/imported.webp`;
const IMAGE_BASE = "course/variants/cover.webp";
const IMAGE_VARIANT = "course/variants/cover-320w.webp";
const SCORM_DIRECTORY = "course/scorm/extracted";
const SCORM_FILE = `${SCORM_DIRECTORY}/content/variants/index.html`;
const UNUSED_FILE = "course/unused.txt";
const ACTOR = {
  tenantId: TENANT_ID,
  userId: "56a33a5e-40f8-43a6-8ef7-2d5a28f1e8d2",
} as never;

function archiveAsset(sourceReference: string) {
  return {
    path: `assets/${sourceReference}`,
    sourceReference,
    sha256: "unused-in-staging-test",
    byteLength: 0,
    contentType: "application/octet-stream",
  };
}

/** An opened archive whose assets are read from the given files, as the ZIP reader serves them. */
function archiveFromFiles(
  assets: ReturnType<typeof archiveAsset>[],
  filePathByAssetPath: Map<string, string>,
): ParsedNativeArchive {
  const getFilePath = (assetPath: string) => {
    const filePath = filePathByAssetPath.get(assetPath);
    if (!filePath) throw new Error("nativeArchive.error.missingAsset");
    return filePath;
  };

  return {
    manifest: { assets },
    openAsset: (assetPath: string) => createReadStream(getFilePath(assetPath)),
    extractAsset: async (assetPath: string) => getFilePath(assetPath),
  } as unknown as ParsedNativeArchive;
}

async function createImageFile(): Promise<{
  directory: string;
  filePath: string;
  byteLength: number;
}> {
  const directory = await mkdtemp(path.join(tmpdir(), "native-archive-assets-"));
  const filePath = path.join(directory, "image.png");
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/m0cAAAAASUVORK5CYII=",
    "base64",
  );
  await writeFile(filePath, image);
  return { directory, filePath, byteLength: image.length };
}

function courseSnapshot(
  thumbnailS3Key: string | null,
  scormPackages: SourceSnapshot["scormPackages"] = [],
): SourceSnapshot {
  return {
    course: {
      thumbnailS3Key,
      authorMetadata: null,
      settings: { certificateSignature: null },
      description: { en: UNUSED_FILE },
    },
    lessons: [],
    questions: [],
    aiMentors: [],
    lessonContentResources: [],
    lessonResources: [],
    questionResources: [],
    courseResources: [],
    scormPackages,
  } as unknown as SourceSnapshot;
}

describe("NativeArchiveAssetsService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("preserves opaque SCORM-package audio instead of applying content-lesson codec restrictions", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "native-scorm-audio-test-"));
    const filePath = path.join(directory, "audio.aac");
    try {
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=duration=0.1",
        "-c:a",
        "aac",
        filePath,
      ]);
      const asset = {
        ...archiveAsset(`${SCORM_DIRECTORY}/audio.aac`),
        contentType: "audio/aac",
        byteLength: (await stat(filePath)).size,
      };
      const storage = {
        isConfigured: jest.fn(() => true),
        getFileExists: jest.fn().mockResolvedValue(false),
        deleteFile: jest.fn(),
        uploadStreamMultipart: jest.fn(async (stream) => {
          for await (const _chunk of stream) {
            /* consume */
          }
        }),
      };
      const archive = archiveFromFiles([asset], new Map([[asset.path, filePath]]));
      const snapshot = courseSnapshot(null, [
        { extractedFilesReference: SCORM_DIRECTORY } as SourceSnapshot["scormPackages"][number],
      ]);
      await new NativeArchiveAssetsService(
        storage as never,
        { archiveResources: jest.fn() } as never,
      ).stageArchiveAssets(archive, ACTOR, [snapshot]);
      expect(storage.uploadStreamMultipart).toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([false, true])("validates streamed imported audio, corrupt=%s", async (corrupt) => {
    const directory = await mkdtemp(path.join(tmpdir(), "native-audio-test-"));
    const filePath = path.join(directory, "audio.wav");
    try {
      if (corrupt) await writeFile(filePath, "not audio");
      else
        execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", filePath]);
      const asset = {
        ...archiveAsset("course/audio.wav"),
        contentType: "audio/wav",
        byteLength: (await stat(filePath)).size,
      };
      const storage = {
        isConfigured: jest.fn(() => true),
        getFileExists: jest.fn().mockResolvedValue(false),
        deleteFile: jest.fn(),
        uploadStreamMultipart: jest.fn(async (stream) => {
          for await (const _chunk of stream) {
            /* consume the real disk stream */
          }
        }),
      };
      const fileService = { archiveResources: jest.fn(), deleteFile: jest.fn() };
      const archive = archiveFromFiles([asset], new Map([[asset.path, filePath]]));
      const snapshot = {
        ...courseSnapshot(null),
        lessonContentResources: [{ reference: asset.sourceReference }],
      } as SourceSnapshot;
      const operation = new NativeArchiveAssetsService(
        storage as never,
        fileService as never,
      ).stageArchiveAssets(archive, ACTOR, [snapshot]);
      if (corrupt) {
        await expect(operation).rejects.toThrow();
        expect(storage.uploadStreamMultipart).not.toHaveBeenCalled();
      } else {
        const staged = await operation;
        expect(storage.uploadStreamMultipart).toHaveBeenCalledWith(
          expect.anything(),
          expect.stringContaining("/native-archive/assets/"),
          "audio/wav",
        );
        expect(staged.snapshots[0].lessonContentResources[0].reference).toContain(
          "/native-archive/assets/",
        );
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("stages referenced image variants and SCORM files, then cleans up uploaded assets", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn().mockResolvedValue({
        resourceId: "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
        fileKey: IMAGE_FILE_KEY,
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NativeArchiveAssetsService(storage as never, fileService as never);
    jest
      .spyOn(FileGuard, "getFileType")
      .mockResolvedValue({ ext: "png", mime: "image/png" } as never);
    const assets = [IMAGE_VARIANT, SCORM_FILE, UNUSED_FILE].map(archiveAsset);
    const { directory, filePath: imagePath, byteLength } = await createImageFile();
    assets[0]!.byteLength = byteLength;
    const archive = archiveFromFiles(
      assets,
      new Map(
        assets.map((asset) => [
          asset.path,
          asset.path === assets[0]!.path ? imagePath : "/unused/test-file",
        ]),
      ),
    );
    const snapshot = courseSnapshot(IMAGE_BASE, [
      { extractedFilesReference: SCORM_DIRECTORY } as SourceSnapshot["scormPackages"][number],
    ]);

    const staged = await service.stageArchiveAssets(archive, ACTOR, [snapshot]);

    expect(fileService.uploadResource).toHaveBeenCalledTimes(1);
    expect(staged.uploadedResourceIdsByFileKey.get(IMAGE_FILE_KEY)).toBe(
      "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
    );
    expect(fileService.uploadResource).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ mimetype: "image/png" }),
        currentUser: ACTOR,
        options: { visibility: RESOURCE_VISIBILITY.PRIVATE },
      }),
    );
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
    expect(storage.uploadFile).toHaveBeenCalledWith(
      Buffer.alloc(0),
      expect.stringContaining("/content/variants/index.html"),
      "text/html",
      0,
    );
    expect(staged.snapshots[0].course.thumbnailS3Key).toBe(IMAGE_FILE_KEY);
    expect(staged.snapshots[0].scormPackages[0].extractedFilesReference).toMatch(
      new RegExp(`^${TENANT_ID}/native-archive/imports/`),
    );
    expect(staged.rewriteReference(IMAGE_VARIANT)).toContain("-320w.webp");
    expect(staged.rewriteReference(UNUSED_FILE)).toBe(UNUSED_FILE);

    await staged.deleteStaged();
    expect(fileService.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith(expect.stringContaining("/content/variants/"));
    expect(fileService.archiveResources).toHaveBeenCalledWith([
      "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
    ]);
    await rm(directory, { recursive: true, force: true });
  });

  it("rejects image candidates whose bytes are not a valid image", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    const asset = archiveAsset("course/cover.png");
    const directory = await mkdtemp(path.join(tmpdir(), "native-archive-invalid-image-"));
    const filePath = path.join(directory, "cover.png");
    await writeFile(filePath, "not an image");
    const archive = archiveFromFiles([asset], new Map([[asset.path, filePath]]));

    await expect(
      new NativeArchiveAssetsService(storage as never, fileService as never).stageArchiveAssets(
        archive,
        ACTOR,
        [courseSnapshot(asset.sourceReference)],
      ),
    ).rejects.toThrow("nativeArchive.error.invalidAssetReference");
    expect(fileService.uploadResource).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    await rm(directory, { recursive: true, force: true });
  });

  it("uses the largest available generated image when the original is absent", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn().mockResolvedValue({
        resourceId: "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
        fileKey: IMAGE_FILE_KEY,
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .spyOn(FileGuard, "getFileType")
      .mockResolvedValue({ ext: "png", mime: "image/png" } as never);

    const candidates = [
      archiveAsset("course/variants/cover-320w.webp"),
      archiveAsset("course/variants/cover-1280w.webp"),
    ];
    const { directory, filePath, byteLength } = await createImageFile();
    candidates.forEach((asset) => {
      asset.byteLength = byteLength;
    });
    const archive = archiveFromFiles(
      candidates,
      new Map(candidates.map((asset) => [asset.path, filePath])),
    );

    const staged = await new NativeArchiveAssetsService(
      storage as never,
      fileService as never,
    ).stageArchiveAssets(archive, ACTOR, [courseSnapshot("course/variants/cover.webp")]);

    expect(fileService.uploadResource).toHaveBeenCalledTimes(1);
    expect(fileService.uploadResource.mock.calls[0]![0].file.buffer).toEqual(
      await readFile(filePath),
    );
    expect(staged.rewriteReference("course/variants/cover.webp")).toBe(IMAGE_FILE_KEY);
    expect(staged.rewriteReference("course/variants/cover-1280w.webp")).toContain("1280w.webp");
    await rm(directory, { recursive: true, force: true });
  });

  it("cleans up an imported image when staging a later asset fails", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn().mockResolvedValue({
        resourceId: "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
        fileKey: IMAGE_FILE_KEY,
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .spyOn(FileGuard, "getFileType")
      .mockResolvedValue({ ext: "png", mime: "image/png" } as never);

    const imageAsset = archiveAsset("course/cover.png");
    const missingAsset = { ...archiveAsset("course/material.pdf"), byteLength: 1 };
    const { directory, filePath, byteLength } = await createImageFile();
    imageAsset.byteLength = byteLength;
    const archive = archiveFromFiles(
      [imageAsset, missingAsset],
      new Map([[imageAsset.path, filePath]]),
    );

    await expect(
      new NativeArchiveAssetsService(storage as never, fileService as never).stageArchiveAssets(
        archive,
        ACTOR,
        [
          {
            ...courseSnapshot(imageAsset.sourceReference),
            courseResources: [{ resource: { reference: missingAsset.sourceReference } }],
          } as SourceSnapshot,
        ],
      ),
    ).rejects.toThrow("nativeArchive.error.missingAsset");

    expect(fileService.deleteFile).toHaveBeenCalledWith(IMAGE_FILE_KEY);
    expect(fileService.archiveResources).toHaveBeenCalledWith([
      "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
    ]);
    await rm(directory, { recursive: true, force: true });
  });

  it("keeps content-addressed files when an upload fails", async () => {
    const uploadError = new Error("upload failed");
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockRejectedValue(uploadError),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn().mockResolvedValue({
        resourceId: "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
        fileKey: IMAGE_FILE_KEY,
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    const asset = archiveAsset(UNUSED_FILE);
    const archive = archiveFromFiles([asset], new Map([[asset.path, "/unused/test-file"]]));
    const snapshot = courseSnapshot(UNUSED_FILE);

    await expect(
      new NativeArchiveAssetsService(storage as never, fileService as never).stageArchiveAssets(
        archive,
        ACTOR,
        [snapshot],
      ),
    ).rejects.toBe(uploadError);
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it("stores only allowlisted passive MIME types for non-image archive assets", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    const assets = [
      { ...archiveAsset("course/lesson.bin"), contentType: "text/html" },
      { ...archiveAsset("course/resource.bin"), contentType: "application/xhtml+xml" },
      { ...archiveAsset("course/handout.pdf"), contentType: "application/pdf" },
    ];
    const archive = archiveFromFiles(
      assets,
      new Map(assets.map((asset) => [asset.path, "/unused/test-file"])),
    );
    const snapshot = {
      ...courseSnapshot(null),
      lessons: [{ fileS3Key: assets[0]!.sourceReference }],
      lessonContentResources: [{ reference: assets[1]!.sourceReference }],
      courseResources: assets
        .slice(2)
        .map((asset) => ({ resource: { reference: asset.sourceReference } })),
    } as unknown as SourceSnapshot;

    await new NativeArchiveAssetsService(storage as never, fileService as never).stageArchiveAssets(
      archive,
      ACTOR,
      [snapshot],
    );

    expect(storage.uploadFile.mock.calls.map(([, , contentType]) => contentType)).toEqual([
      "application/octet-stream",
      "application/octet-stream",
      "application/pdf",
    ]);
  });

  it("stages learning path and live training materials", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn().mockResolvedValue({
        resourceId: "b3da5ec2-9e50-4da5-96d7-d3ca5ee4c740",
        fileKey: IMAGE_FILE_KEY,
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    const references = [
      "path/thumbnail.png",
      "path/signature.png",
      "path/icon.svg",
      "training/handout.pdf",
    ];
    const assets = references.map(archiveAsset);
    const { directory, filePath, byteLength } = await createImageFile();
    const svgPath = path.join(directory, "icon.svg");
    await writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
    assets
      .filter((asset) => asset.sourceReference.endsWith(".png"))
      .forEach((asset) => {
        asset.byteLength = byteLength;
      });
    const archive = archiveFromFiles(
      assets,
      new Map(
        assets.map((asset) => {
          let assetPath = "/unused/test-file";
          if (asset.sourceReference.endsWith(".png")) assetPath = filePath;
          if (asset.sourceReference.endsWith(".svg")) assetPath = svgPath;
          return [asset.path, assetPath];
        }),
      ),
    );
    const snapshot = {
      ...courseSnapshot(references[0]!),
      liveTrainingLessons: [{ materials: [{ resource: { reference: references[3] } }] }],
    } as SourceSnapshot;
    const learningPath = {
      thumbnailReference: references[2],
      settings: { certificateSignature: references[1], certificateFontColor: null },
    };
    jest.spyOn(FileGuard, "getFileType").mockImplementation(async (file) => {
      const buffer = Buffer.isBuffer(file) ? file : file.buffer;
      return buffer.toString("utf8").startsWith("<svg")
        ? undefined
        : ({ ext: "png", mime: "image/png" } as never);
    });

    const staged = await new NativeArchiveAssetsService(
      storage as never,
      fileService as never,
    ).stageArchiveAssets(archive, ACTOR, [snapshot], learningPath);

    expect(fileService.uploadResource).toHaveBeenCalledTimes(3);
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
    const svgUpload = fileService.uploadResource.mock.calls.find(
      ([{ file }]) => file.originalname === "icon.svg",
    )?.[0].file;
    expect(svgUpload?.mimetype).toBe("image/png");
    expect(svgUpload?.buffer.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    references.slice(0, 3).forEach((reference) => {
      expect(staged.rewriteReference(reference)).toBe(IMAGE_FILE_KEY);
    });
    expect(staged.rewriteReference(references[3]!)).toMatch(
      new RegExp(`^${TENANT_ID}/native-archive/assets/`),
    );
    await rm(directory, { recursive: true, force: true });
  });

  function arrangePlainFileStaging(existingKeys: Set<string> = new Set()) {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      getFileExists: jest.fn(async (key: string) => existingKeys.has(key)),
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const fileService = {
      uploadResource: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      archiveResources: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NativeArchiveAssetsService(storage as never, fileService as never);

    const stageHandouts = async (assets: ReturnType<typeof archiveAsset>[]) => {
      const archive = archiveFromFiles(assets, new Map());
      const snapshot = {
        ...courseSnapshot(null),
        courseResources: assets.map((asset) => ({
          resource: { reference: asset.sourceReference },
        })),
      } as unknown as SourceSnapshot;

      return service.stageArchiveAssets(archive, ACTOR, [snapshot]);
    };

    return { storage, stageHandouts };
  }

  it("skips a file that an earlier import already stored under its content key", async () => {
    const handout = { ...archiveAsset("course/handout.pdf"), sha256: "a".repeat(64) };
    const first = arrangePlainFileStaging();
    const stagedKey = (await first.stageHandouts([handout])).rewriteReference(
      handout.sourceReference,
    );

    const repeat = arrangePlainFileStaging(new Set([stagedKey ?? ""]));
    const repeated = await repeat.stageHandouts([handout]);

    expect(stagedKey).toMatch(
      new RegExp(`^${TENANT_ID}/native-archive/assets/[a-f0-9]{64}\\.pdf$`),
    );
    expect(repeated.rewriteReference(handout.sourceReference)).toBe(stagedKey);
    expect(repeat.storage.uploadFile).not.toHaveBeenCalled();
  });

  it.each([
    {
      change: "the same file imported again",
      sha256: "a".repeat(64),
      reference: "course/a.pdf",
      sameKey: true,
    },
    {
      change: "different bytes",
      sha256: "b".repeat(64),
      reference: "course/a.pdf",
      sameKey: false,
    },
    {
      change: "another source file with the same bytes",
      sha256: "a".repeat(64),
      reference: "course/b.pdf",
      sameKey: false,
    },
  ])("keys $change by content and source reference", async ({ sha256, reference, sameKey }) => {
    const original = { ...archiveAsset("course/a.pdf"), sha256: "a".repeat(64) };
    const candidate = { ...archiveAsset(reference), sha256 };

    const originalKey = (
      await arrangePlainFileStaging().stageHandouts([original])
    ).rewriteReference(original.sourceReference);
    const candidateKey = (
      await arrangePlainFileStaging().stageHandouts([candidate])
    ).rewriteReference(candidate.sourceReference);

    expect(candidateKey === originalKey).toBe(sameKey);
  });

  it("uploads several files at once, never more than the batch size", async () => {
    const { storage, stageHandouts } = arrangePlainFileStaging();
    let inFlight = 0;
    let maxInFlight = 0;
    storage.uploadFile.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });
    const handouts = Array.from(
      { length: NATIVE_ARCHIVE_LIMITS.ASSET_UPLOAD_BATCH_SIZE * 2 },
      (_, index) => ({
        ...archiveAsset(`course/handout-${index}.pdf`),
        sha256: index.toString(16).padStart(64, "0"),
      }),
    );

    await stageHandouts(handouts);

    expect(storage.uploadFile).toHaveBeenCalledTimes(handouts.length);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(NATIVE_ARCHIVE_LIMITS.ASSET_UPLOAD_BATCH_SIZE);
  });
});
