import { ConflictException, Inject, Injectable } from "@nestjs/common";
import sharp from "sharp";

import { S3Service } from "src/s3/s3.service";

import { IMAGE_VARIANT_DEFINITIONS, IMAGE_VARIANT_CONTENT_TYPE } from "./image-variant.constants";
import {
  buildImageVariantReferenceKey,
  getImageVariantKey,
  isSupportedImageVariantMimeType,
} from "./image-variant.utils";

import type {
  ImageQuality,
  ImageVariantCreationOptions,
  ImageResizeMode,
  ImageVariantBufferDetails,
  ImageVariantDefinition,
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
    options?: ImageVariantCreationOptions;
  }): Promise<ImageVariantUploadResult | null> {
    if (!this.supports(params.mimeType)) return null;

    try {
      const sourceMetadata = await sharp(params.buffer).metadata();

      if (!sourceMetadata.width || !sourceMetadata.height) {
        throw new Error("Missing source image dimensions");
      }

      const referenceKey = buildImageVariantReferenceKey(params.resource, params.tenantId);
      const variantDefinitions = params.options?.variantDefinitions ?? IMAGE_VARIANT_DEFINITIONS;
      const resizeMode = params.options?.resizeMode ?? "contain";

      const variantsWithBuffers = Object.fromEntries(
        await Promise.all(
          variantDefinitions.map(async (definition) => [
            definition.quality,
            await this.createVariant(
              params.buffer,
              referenceKey,
              sourceMetadata,
              definition,
              resizeMode,
            ),
          ]),
        ),
      ) as Partial<Record<ImageQuality, ImageVariantBufferDetails>>;

      await Promise.all(
        Object.values(variantsWithBuffers)
          .filter((variant): variant is ImageVariantBufferDetails => Boolean(variant))
          .map((variant) =>
            this.s3Service.uploadFile(variant.buffer, variant.key, IMAGE_VARIANT_CONTENT_TYPE),
          ),
      );

      const variants = this.removeBuffersFromVariants(variantsWithBuffers, variantDefinitions);

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
    options?: ImageVariantCreationOptions;
  }): Promise<ImageVariantUploadResult | null> {
    if (!this.supports(params.mimeType)) return null;

    try {
      const sourceMetadata = await sharp(params.buffer).metadata();

      if (!sourceMetadata.width || !sourceMetadata.height) {
        throw new Error("Missing source image dimensions");
      }

      const variantDefinitions = params.options?.variantDefinitions ?? IMAGE_VARIANT_DEFINITIONS;
      const resizeMode = params.options?.resizeMode ?? "contain";

      const variantsWithBuffers = Object.fromEntries(
        await Promise.all(
          variantDefinitions.map(async (definition) => [
            definition.quality,
            await this.createVariant(
              params.buffer,
              params.referenceKey,
              sourceMetadata,
              definition,
              resizeMode,
            ),
          ]),
        ),
      ) as Partial<Record<ImageQuality, ImageVariantBufferDetails>>;

      await Promise.all(
        Object.values(variantsWithBuffers)
          .filter((variant): variant is ImageVariantBufferDetails => Boolean(variant))
          .map((variant) =>
            this.s3Service.uploadFile(variant.buffer, variant.key, IMAGE_VARIANT_CONTENT_TYPE),
          ),
      );

      return {
        referenceKey: params.referenceKey,
        contentType: IMAGE_VARIANT_CONTENT_TYPE,
        metadata: {
          originalWidth: sourceMetadata.width,
          originalHeight: sourceMetadata.height,
          variants: this.removeBuffersFromVariants(variantsWithBuffers, variantDefinitions),
        },
      };
    } catch {
      throw new ConflictException("files.toast.imageVariantGenerationFailed");
    }
  }

  private resizeToWebp(buffer: Buffer, width: ImageVariantWidth, resizeMode: ImageResizeMode) {
    if (resizeMode === "cover-square") {
      return sharp(buffer)
        .rotate()
        .resize({ width, height: width, fit: "cover", position: "center" })
        .webp({ quality: 82 })
        .toBuffer();
    }

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
    variantsWithBuffers: Partial<Record<ImageQuality, ImageVariantBufferDetails>>,
    variantDefinitions: readonly ImageVariantDefinition[] = IMAGE_VARIANT_DEFINITIONS,
  ) {
    const variantEntries: Array<[ImageQuality, ImageVariantDetails]> = [];

    for (const { quality } of variantDefinitions) {
      const variant = variantsWithBuffers[quality];
      if (variant) {
        variantEntries.push([quality, this.removeBuffer(variant)]);
      }
    }

    return Object.fromEntries(variantEntries) as Partial<Record<ImageQuality, ImageVariantDetails>>;
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
    definition: ImageVariantDefinition,
    resizeMode: ImageResizeMode,
  ): Promise<ImageVariantBufferDetails> {
    const { quality, width } = definition;
    const height =
      resizeMode === "cover-square"
        ? width
        : this.calculateHeight(sourceMetadata.width, sourceMetadata.height, width);

    return {
      key: getImageVariantKey(referenceKey, quality),
      width,
      height,
      contentType: IMAGE_VARIANT_CONTENT_TYPE,
      buffer: await this.resizeToWebp(buffer, width, resizeMode),
    };
  }
}
