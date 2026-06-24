import { ConflictException, Inject, Injectable } from "@nestjs/common";
import sharp from "sharp";

import { S3Service } from "src/s3/s3.service";

import {
  IMAGE_VARIANT_DEFINITIONS,
  IMAGE_VARIANT_CONTENT_TYPE,
  IMAGE_VARIANT_WIDTHS,
} from "./image-variant.constants";
import {
  buildImageVariantReferenceKey,
  getImageVariantKey,
  isSupportedImageVariantMimeType,
} from "./image-variant.utils";

import type {
  ImageQuality,
  ImageVariantBufferDetails,
  ImageVariantDetails,
  ImageVariantUploadResult,
  ImageVariantWidth,
} from "./image-variant.types";
import type { UUIDType } from "src/common";

@Injectable()
export class ImageVariantService {
  constructor(@Inject(S3Service) private readonly s3Service: S3Service) {}

  supports(mimeType: string) {
    return isSupportedImageVariantMimeType(mimeType);
  }

  async createVariants(params: {
    buffer: Buffer;
    resource: string;
    mimeType: string;
    tenantId: UUIDType;
  }): Promise<ImageVariantUploadResult | null> {
    if (!this.supports(params.mimeType)) return null;

    try {
      const sourceMetadata = await sharp(params.buffer).metadata();

      if (!sourceMetadata.width || !sourceMetadata.height) {
        throw new Error("Missing source image dimensions");
      }

      const referenceKey = buildImageVariantReferenceKey(params.resource, params.tenantId);

      const variantsWithBuffers = Object.fromEntries(
        await Promise.all(
          IMAGE_VARIANT_DEFINITIONS.map(async ({ quality }) => [
            quality,
            await this.createVariant(params.buffer, referenceKey, sourceMetadata, quality),
          ]),
        ),
      ) as Record<ImageQuality, ImageVariantBufferDetails>;

      await Promise.all(
        Object.values(variantsWithBuffers).map((variant) =>
          this.s3Service.uploadFile(variant.buffer, variant.key, IMAGE_VARIANT_CONTENT_TYPE),
        ),
      );

      const variants = this.removeBuffersFromVariants(variantsWithBuffers);

      return {
        referenceKey,
        contentType: IMAGE_VARIANT_CONTENT_TYPE,
        metadata: {
          originalWidth: sourceMetadata.width,
          originalHeight: sourceMetadata.height,
          variants,
        },
      };
    } catch {
      throw new ConflictException("files.toast.imageVariantGenerationFailed");
    }
  }

  async createVariantsForReference(params: {
    buffer: Buffer;
    referenceKey: string;
    mimeType: string;
  }): Promise<ImageVariantUploadResult | null> {
    if (!this.supports(params.mimeType)) return null;

    try {
      const sourceMetadata = await sharp(params.buffer).metadata();

      if (!sourceMetadata.width || !sourceMetadata.height) {
        throw new Error("Missing source image dimensions");
      }

      const variantsWithBuffers = Object.fromEntries(
        await Promise.all(
          IMAGE_VARIANT_DEFINITIONS.map(async ({ quality }) => [
            quality,
            await this.createVariant(params.buffer, params.referenceKey, sourceMetadata, quality),
          ]),
        ),
      ) as Record<ImageQuality, ImageVariantBufferDetails>;

      await Promise.all(
        Object.values(variantsWithBuffers).map((variant) =>
          this.s3Service.uploadFile(variant.buffer, variant.key, IMAGE_VARIANT_CONTENT_TYPE),
        ),
      );

      return {
        referenceKey: params.referenceKey,
        contentType: IMAGE_VARIANT_CONTENT_TYPE,
        metadata: {
          originalWidth: sourceMetadata.width,
          originalHeight: sourceMetadata.height,
          variants: this.removeBuffersFromVariants(variantsWithBuffers),
        },
      };
    } catch {
      throw new ConflictException("files.toast.imageVariantGenerationFailed");
    }
  }

  private resizeToWebp(buffer: Buffer, width: ImageVariantWidth) {
    return sharp(buffer).rotate().resize({ width }).webp({ quality: 82 }).toBuffer();
  }

  private calculateHeight(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: ImageVariantWidth,
  ) {
    return Math.round((sourceHeight / sourceWidth) * targetWidth);
  }

  private removeBuffersFromVariants(
    variantsWithBuffers: Record<ImageQuality, ImageVariantBufferDetails>,
  ) {
    return Object.fromEntries(
      IMAGE_VARIANT_DEFINITIONS.map(({ quality }) => [
        quality,
        this.removeBuffer(variantsWithBuffers[quality]),
      ]),
    ) as Record<ImageQuality, ImageVariantDetails>;
  }

  private removeBuffer(variant: ImageVariantBufferDetails): ImageVariantDetails {
    return {
      key: variant.key,
      width: variant.width,
      height: variant.height,
      contentType: variant.contentType,
    };
  }

  private async createVariant(
    buffer: Buffer,
    referenceKey: string,
    sourceMetadata: { width: number; height: number },
    quality: ImageQuality,
  ): Promise<ImageVariantBufferDetails> {
    const width = IMAGE_VARIANT_WIDTHS[quality];
    const height = this.calculateHeight(sourceMetadata.width, sourceMetadata.height, width);

    return {
      key: getImageVariantKey(referenceKey, quality),
      width,
      height,
      contentType: IMAGE_VARIANT_CONTENT_TYPE,
      buffer: await this.resizeToWebp(buffer, width),
    };
  }
}
