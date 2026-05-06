import path from "node:path";

import { BadRequestException } from "@nestjs/common";

import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";

import type { UUIDType } from "src/common";

const SCORM_ROOT = "scorm";

export const normalizeScormRelativePath = (input: string) => {
  const decodedInput = input.trim();

  if (!decodedInput) {
    throw new BadRequestException("adminScorm.errors.invalidPackagePath");
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(decodedInput) || decodedInput.startsWith("//")) {
    throw new BadRequestException("adminScorm.errors.externalPackagePath");
  }

  const normalized = path.posix.normalize(decodedInput.replaceAll("\\", "/")).replace(/^\/+/, "");

  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new BadRequestException("adminScorm.errors.invalidPackagePath");
  }

  return normalized;
};

export const joinScormRelativePath = (...parts: Array<string | undefined | null>) => {
  const usefulParts = parts.filter((part): part is string => Boolean(part) && part !== ".");

  return normalizeScormRelativePath(path.posix.join(...usefulParts));
};

export const sanitizeScormFilename = (filename: string) => {
  const baseName = path.posix.basename(filename.replaceAll("\\", "/"));
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return sanitized.toLowerCase().endsWith(".zip") ? sanitized : `${sanitized}.zip`;
};

export const getScormPackagePrefix = (tenantId: UUIDType, packageId: UUIDType) =>
  prefixTenantStorageKey(`${SCORM_ROOT}/packages/${packageId}`, tenantId);

export const getScormOriginalFileReference = (
  tenantId: UUIDType,
  packageId: UUIDType,
  originalFilename: string,
) =>
  `${getScormPackagePrefix(tenantId, packageId)}/original/${sanitizeScormFilename(originalFilename)}`;

export const getScormExtractedFilesReference = (tenantId: UUIDType, packageId: UUIDType) =>
  `${getScormPackagePrefix(tenantId, packageId)}/extracted`;

export const getScormExtractedFileReference = (
  tenantId: UUIDType,
  packageId: UUIDType,
  relativePath: string,
) =>
  `${getScormExtractedFilesReference(tenantId, packageId)}/${normalizeScormRelativePath(relativePath)}`;

export const getScormManifestReference = (
  tenantId: UUIDType,
  packageId: UUIDType,
  manifestPath = "imsmanifest.xml",
) => getScormExtractedFileReference(tenantId, packageId, manifestPath);

export const getScormScoLaunchReference = (
  tenantId: UUIDType,
  packageId: UUIDType,
  launchPath: string,
) => getScormExtractedFileReference(tenantId, packageId, launchPath);
