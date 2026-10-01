import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Readable } from "node:stream";

import sharp from "sharp";

import { S3Service } from "src/s3/s3.service";

import {
  createNativeArchiveCourseSnapshot,
  createNativeArchiveImportInput,
  writeNativeArchiveZip,
} from "./native-archive-import.e2e-utils";

import type { NativeArchiveBuildInput } from "../../native-archive.types";

export async function createNativeArchiveWithCourseThumbnail(directory: string) {
  await mkdir(directory, { recursive: true });
  const sourceCourseId = randomUUID();
  const sourceReference = "archive-assets/course-cover.png";
  const imageBuffer = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 24, g: 104, b: 168 },
    },
  })
    .png()
    .toBuffer();
  const snapshot = createNativeArchiveCourseSnapshot(sourceCourseId);
  Object.assign(snapshot.course, { thumbnailS3Key: sourceReference });

  const input = createNativeArchiveImportInput("course", [snapshot]);
  const imageFile: NativeArchiveBuildInput["files"][number] = {
    path: "assets/course-cover.png",
    sourceReference,
    // Archive manifests intentionally keep non-video asset content types opaque.
    contentType: "application/octet-stream",
    open: async () => Readable.from([imageBuffer]),
  };
  input.files.push(imageFile);

  return {
    imageBuffer,
    sourceCourseId,
    sourceReference,
    zipPath: await writeNativeArchiveZip(input, directory),
  };
}

export async function createNativeArchiveWithThumbnailAndAttachment(directory: string) {
  await mkdir(directory, { recursive: true });
  const sourceCourseId = randomUUID();
  const imageReference = "archive-assets/course-cover.png";
  const attachmentReference = "archive-assets/course-handout.pdf";
  const imageBuffer = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 24, g: 104, b: 168 },
    },
  })
    .png()
    .toBuffer();
  const attachmentBuffer = Buffer.from("test attachment payload");
  const snapshot = createNativeArchiveCourseSnapshot(sourceCourseId);
  Object.assign(snapshot.course, {
    thumbnailS3Key: imageReference,
    settings: { certificateSignature: attachmentReference },
  });

  const input = createNativeArchiveImportInput("course", [snapshot]);
  input.files.push(
    {
      path: "assets/course-cover.png",
      sourceReference: imageReference,
      contentType: "application/octet-stream",
      open: async () => Readable.from([imageBuffer]),
    },
    {
      path: "assets/course-handout.pdf",
      sourceReference: attachmentReference,
      contentType: "application/octet-stream",
      open: async () => Readable.from([attachmentBuffer]),
    },
  );

  return {
    attachmentReference,
    imageReference,
    sourceCourseId,
    zipPath: await writeNativeArchiveZip(input, directory),
  };
}

export function createNativeArchiveAssetImportStorage() {
  const objects = new Map<string, { buffer: Buffer; contentType: string }>();
  const uploadedKeys: string[] = [];
  const copiedKeys: string[] = [];
  const s3ServiceMock = {
    isConfigured: jest.fn(() => true),
    uploadFile: jest.fn(async (value: Buffer | Readable, key: string, contentType: string) => {
      const chunks: Buffer[] = [];
      if (Buffer.isBuffer(value)) {
        chunks.push(value);
      } else {
        for await (const chunk of value) chunks.push(Buffer.from(chunk));
      }
      objects.set(key, { buffer: Buffer.concat(chunks), contentType });
      uploadedKeys.push(key);
    }),
    uploadStreamMultipart: jest.fn(async (stream: Readable, key: string, contentType: string) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      objects.set(key, { buffer: Buffer.concat(chunks), contentType });
      uploadedKeys.push(key);
    }),
    deleteFile: jest.fn(async (key: string) => {
      objects.delete(key);
    }),
    getSignedUrl: jest.fn(async (key: string) => `https://storage.test/${key}`),
    getFileExists: jest.fn(async (key: string) => objects.has(key)),
    listFileKeysByPrefix: jest.fn(async (prefix: string) =>
      [...objects.keys()].filter((key) => key.startsWith(prefix)),
    ),
    copyFile: jest.fn(async (sourceKey: string, destinationKey: string, contentType?: string) => {
      const source = objects.get(sourceKey);
      if (!source) throw new Error(`Missing in-memory asset ${sourceKey}`);
      objects.set(destinationKey, {
        buffer: Buffer.from(source.buffer),
        contentType: contentType ?? source.contentType,
      });
      copiedKeys.push(destinationKey);
    }),
  };

  return {
    provider: { provide: S3Service, useValue: s3ServiceMock },
    s3ServiceMock,
    uploadedKeys,
    copiedKeys,
    getObject: (key: string) => objects.get(key),
    get objects() {
      return objects;
    },
  };
}
