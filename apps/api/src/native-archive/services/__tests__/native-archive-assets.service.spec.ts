import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { RESOURCE_VISIBILITY } from "@repo/shared";

import { FileGuard } from "src/file/guards/file.guard";

import { NativeArchiveAssetsService } from "../native-archive-assets.service";

import type { ParsedNativeArchive } from "../../native-archive.types";
import type { UUIDType } from "src/common";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

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

  it("stages referenced image variants and SCORM files, then cleans up uploaded assets", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
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
    const archive = {
      manifest: { assets },
      assetFiles: new Map(
        assets.map((asset) => [
          asset.path,
          asset.path === assets[0]!.path ? imagePath : "/unused/test-file",
        ]),
      ),
    } as ParsedNativeArchive;
    const snapshot = courseSnapshot(IMAGE_BASE, [
      { extractedFilesReference: SCORM_DIRECTORY } as SourceSnapshot["scormPackages"][number],
    ]);

    const staged = await service.stageArchiveAssets(archive, ACTOR, [snapshot]);

    expect(fileService.uploadResource).toHaveBeenCalledTimes(1);
    expect(fileService.uploadResource).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ mimetype: "image/png" }),
        currentUser: ACTOR,
        options: { visibility: RESOURCE_VISIBILITY.PRIVATE },
      }),
    );
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
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
    const archive = {
      manifest: { assets: [asset] },
      assetFiles: new Map([[asset.path, filePath]]),
    } as ParsedNativeArchive;

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
    const archive = {
      manifest: { assets: candidates },
      assetFiles: new Map(candidates.map((asset) => [asset.path, filePath])),
    } as ParsedNativeArchive;

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
    const missingAsset = archiveAsset("course/material.pdf");
    const { directory, filePath, byteLength } = await createImageFile();
    imageAsset.byteLength = byteLength;
    const archive = {
      manifest: { assets: [imageAsset, missingAsset] },
      assetFiles: new Map([[imageAsset.path, filePath]]),
    } as ParsedNativeArchive;

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

  it("removes the target file when an upload fails", async () => {
    const uploadError = new Error("upload failed");
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
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
    const archive = {
      manifest: { assets: [asset] },
      assetFiles: new Map([[asset.path, "/unused/test-file"]]),
    } as ParsedNativeArchive;
    const snapshot = courseSnapshot(UNUSED_FILE);

    await expect(
      new NativeArchiveAssetsService(storage as never, fileService as never).stageArchiveAssets(
        archive,
        ACTOR,
        [snapshot],
      ),
    ).rejects.toBe(uploadError);
    expect(storage.deleteFile).toHaveBeenCalledWith(expect.stringContaining("/files/"));
  });

  it("stages learning path and live training materials", async () => {
    const storage = {
      isConfigured: jest.fn().mockReturnValue(true),
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
    const archive = {
      manifest: { assets },
      assetFiles: new Map(
        assets.map((asset) => {
          let assetPath = "/unused/test-file";
          if (asset.sourceReference.endsWith(".png")) assetPath = filePath;
          if (asset.sourceReference.endsWith(".svg")) assetPath = svgPath;
          return [asset.path, assetPath];
        }),
      ),
    } as ParsedNativeArchive;
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
    references.slice(0, 3).forEach((reference) => {
      expect(staged.rewriteReference(reference)).toBe(IMAGE_FILE_KEY);
    });
    expect(staged.rewriteReference(references[3]!)).toMatch(
      new RegExp(`^${TENANT_ID}/native-archive/imports/`),
    );
    await rm(directory, { recursive: true, force: true });
  });
});
