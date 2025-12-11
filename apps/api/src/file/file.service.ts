import { randomUUID } from "crypto";
import { Readable } from "stream";

import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { and, eq, getTableColumns } from "drizzle-orm";
import Excel from "exceljs";
import { isEmpty } from "lodash";
import sharp from "sharp";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { S3Service } from "src/s3/s3.service";
import { resources, resourceEntity } from "src/storage/schema";

import {
  MAX_FILE_SIZE,
  ALLOWED_EXCEL_MIME_TYPES,
  ALLOWED_EXCEL_MIME_TYPES_MAP,
  ALLOWED_MIME_TYPES,
  RESOURCE_RELATIONSHIP_TYPES,
} from "./file.constants";
import { FileGuard } from "./guards/file.guard";

import type { ResourceRelationshipType, EntityType, ResourceCategory } from "./file.constants";
import type { FileValidationOptions } from "./guards/file.guard";
import type { ExcelHyperlinkCell } from "./types/excel";
import type { SupportedLanguages } from "@repo/shared";
import type { Static, TSchema } from "@sinclair/typebox";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class FileService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
  ) {}

  async getFileUrl(fileKey: string): Promise<string> {
    if (!fileKey) return "https://app.lms.localhost/app/assets/placeholders/card-placeholder.jpg";
    if (fileKey.startsWith("https://")) return fileKey;
    if (fileKey.startsWith("bunny-")) {
      const videoId = fileKey.replace("bunny-", "");

      return this.bunnyStreamService.getUrl(videoId);
    }
    return await this.s3Service.getSignedUrl(fileKey);
  }

  async getFileBuffer(fileKey: string): Promise<Buffer | null> {
    if (!fileKey) return null;

    try {
      if (fileKey.startsWith("https://") || fileKey.startsWith("http://")) {
        const response = await fetch(fileKey);

        if (!response.ok) {
          throw new Error(`Failed to download remote file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return sharp(Buffer.from(arrayBuffer), { density: 300 }).toBuffer();
      }

      const buffer = await this.s3Service.getFileBuffer(fileKey);
      return sharp(buffer, { density: 300 }).toBuffer();
    } catch (error) {
      return null;
    }
  }

  async uploadFile(file: Express.Multer.File, resource: string, options?: FileValidationOptions) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    if (!file.originalname || !file.buffer) {
      throw new BadRequestException("File upload failed - invalid file data");
    }

    const { type } = await FileGuard.validateFile(
      file,
      options ?? { allowedTypes: ALLOWED_MIME_TYPES, maxSize: MAX_FILE_SIZE },
    );

    try {
      if (file.mimetype.startsWith("video/")) {
        const result = await this.bunnyStreamService.upload(file);

        return {
          fileKey: result.fileKey,
          fileUrl: result.fileUrl,
        };
      }

      const fileExtension = file.originalname.split(".").pop();
      const fileKey = `${resource}/${randomUUID()}.${fileExtension}`;

      await this.s3Service.uploadFile(file.buffer, fileKey, type);

      const fileUrl = await this.s3Service.getSignedUrl(fileKey);

      return {
        fileKey,
        fileUrl,
      };
    } catch (error) {
      console.error("Upload error:", error);
      throw new ConflictException("Failed to upload file");
    }
  }

  async deleteFile(fileKey: string) {
    try {
      if (fileKey.startsWith("bunny-")) {
        const videoId = fileKey.replace("bunny-", "");
        return await this.bunnyStreamService.delete(videoId);
      }
      return await this.s3Service.deleteFile(fileKey);
    } catch (error) {
      throw new ConflictException("Failed to delete file");
    }
  }

  async getFileStream(fileKey: string) {
    try {
      return await this.s3Service.getFileStream(fileKey);
    } catch (error) {
      throw new BadRequestException("Failed to retrieve file");
    }
  }

  async parseExcelFile<T extends TSchema>(
    file: Express.Multer.File,
    schema: T,
  ): Promise<Static<T>[]> {
    if (!file) {
      throw new BadRequestException({ message: "files.import.noFileUploaded" });
    }

    if (!file.originalname || !file.buffer) {
      throw new BadRequestException({ message: "files.import.invalidFileData" });
    }

    if (
      !ALLOWED_EXCEL_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_EXCEL_MIME_TYPES)[number])
    ) {
      throw new BadRequestException({ message: "files.import.invalidFileType" });
    }

    const validator = TypeCompiler.Compile(schema);

    const fileStream = Readable.from(file.buffer);
    const workbook = new Excel.Workbook();

    const worksheet =
      file.mimetype === ALLOWED_EXCEL_MIME_TYPES_MAP.csv
        ? await workbook.csv.read(fileStream, {
            parserOptions: { delimiter: "," },
          })
        : await workbook.xlsx.read(fileStream).then(() => workbook.worksheets[0]);

    const allSheetValues = worksheet.getSheetValues();
    if (!allSheetValues || allSheetValues.length <= 1)
      throw new BadRequestException({ message: "files.import.fileEmpty" });

    const headers = (allSheetValues[1] as string[]).map((h) => String(h).trim().replace(/\r/, ""));
    const rows = allSheetValues.slice(2);

    const parsedCsvData = rows.map((rowValues) => {
      if (!Array.isArray(rowValues)) return;

      const parsedObject: Record<string, string | string[]> = {};

      headers.forEach((header, colIndex) => {
        const normalizedHeader = header.trim();

        const cellValue = rowValues[colIndex];

        if (header === "groups" && typeof cellValue === "string") {
          parsedObject[normalizedHeader] = cellValue.split(",");

          return;
        }

        if (cellValue && typeof cellValue === "object" && "hyperlink" in cellValue) {
          parsedObject[normalizedHeader] = String((cellValue as ExcelHyperlinkCell).hyperlink)
            .replace(/^mailto:/, "")
            .trim();

          return;
        }

        if (!isEmpty(cellValue)) parsedObject[normalizedHeader] = String(cellValue).trim();
      });

      if (isEmpty(parsedObject)) return null;

      if (!validator.Check(parsedObject))
        throw new BadRequestException({
          message: "files.import.requiredDataMissing",
        });

      return parsedObject as Static<T>;
    });

    return parsedCsvData.filter((item) => item !== null);
  }

  /**
   * Upload a file and create a resource record linked to an entity
   * @param file - The uploaded file from Express.Multer
   * @param resource - The resource path/category for organizing uploads (e.g., 'courses', 'lessons')
   * @param entityId - The ID of the entity this resource belongs to
   * @param entityType - The type of entity (e.g., 'course', 'lesson', 'chapter', 'question')
   * @param relationshipType - The relationship between resource and entity (default: 'attachment')
   * @param currentUser - Current user object
   * @param title - Multilingual title object (optional)
   * @param description - Multilingual description object (optional)
   * @returns Object containing resourceId, fileKey, and fileUrl
   */
  async uploadResource(
    file: Express.Multer.File,
    folder: string,
    resource: ResourceCategory,
    entityId: string,
    entityType: EntityType,
    relationshipType: ResourceRelationshipType = RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
    title: Partial<Record<SupportedLanguages, string>> = {},
    description: Partial<Record<SupportedLanguages, string>> = {},
    currentUser?: CurrentUser,
  ) {
    const { fileKey } = await this.uploadFile(file, `${folder}/${resource}`);

    const { insertedResource } = await this.db.transaction(async (trx) => {
      const [insertedResource] = await trx
        .insert(resources)
        .values({
          title: buildJsonbFieldWithMultipleEntries(title || {}),
          description: buildJsonbFieldWithMultipleEntries(description || {}),
          reference: fileKey,
          contentType: file.mimetype,
          metadata: {
            originalFilename: file.originalname,
            size: file.size,
          },
          uploadedBy: currentUser?.userId || null,
        })
        .returning();

      await trx.insert(resourceEntity).values({
        resourceId: insertedResource.id,
        entityId,
        entityType,
        relationshipType,
      });

      return { insertedResource };
    });

    if (!insertedResource) throw new BadRequestException("adminResources.toast.uploadError");

    return {
      resourceId: insertedResource.id,
      fileKey,
      fileUrl: await this.getFileUrl(fileKey),
    };
  }

  /**
   * Get all resources for a specific entity
   * @param entityId - The ID of the entity
   * @param entityType - The type of entity (e.g., 'course', 'lesson', 'chapter', 'question')
   * @param relationshipType - Filter by relationship type (optional)
   * @returns Array of resources with file URLs
   */
  async getResourcesForEntity(entityId: UUIDType, entityType: string, relationshipType?: string) {
    const results = await this.db
      .select({
        ...getTableColumns(resources),
      })
      .from(resources)
      .innerJoin(resourceEntity, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, entityId),
          eq(resourceEntity.entityType, entityType),
          relationshipType ? eq(resourceEntity.relationshipType, relationshipType) : undefined,
        ),
      );

    return Promise.all(
      results.map(async (resource) => ({
        ...resource,
        fileUrl: await this.getFileUrl(resource.reference),
      })),
    );
  }
}
