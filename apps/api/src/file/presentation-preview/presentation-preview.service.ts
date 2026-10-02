import { Readable } from "node:stream";

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { S3_OPERATION_TIMEOUT_MS } from "src/s3/s3.constants";
import { S3Service } from "src/s3/s3.service";
import { dbAls } from "src/storage/db/db-als.store";

import { PresentationConverterClient } from "./presentation-converter.client";
import {
  MAX_CONCURRENT_PRESENTATIONS,
  MAX_PRESENTATION_BYTES,
} from "./presentation-preview.constants";

@Injectable()
export class PresentationPreviewService {
  private readonly pending = new Map<string, Promise<string>>();

  constructor(
    private readonly s3: S3Service,
    private readonly converter: PresentationConverterClient,
  ) {}

  getOrCreate(fileKey: string): Promise<string> {
    const tenantId = dbAls.getStore()?.tenantId;
    if (
      !tenantId ||
      !fileKey.startsWith(`${tenantId}/`) ||
      !/\.(pptx|odp)$/i.test(fileKey) ||
      fileKey.includes("\\") ||
      fileKey.split("/").some((segment) => segment === ".." || segment === "." || !segment)
    ) {
      throw new BadRequestException("files.toast.previewGenerationFailed");
    }
    const extension = fileKey.toLowerCase().endsWith(".pptx") ? "pptx" : "odp";
    const pdfKey = fileKey.replace(/\.(pptx|odp)$/i, ".preview.pdf");
    const existing = this.pending.get(pdfKey);
    if (existing) return existing;
    if (this.pending.size >= MAX_CONCURRENT_PRESENTATIONS) {
      throw new ServiceUnavailableException("files.toast.previewGenerationFailed");
    }
    const task = this.create(fileKey, pdfKey, extension)
      .catch(() => {
        throw new InternalServerErrorException("Presentation conversion failed");
      })
      .finally(() => {
        this.pending.delete(pdfKey);
      });
    this.pending.set(pdfKey, task);
    return task;
  }

  private async create(
    fileKey: string,
    pdfKey: string,
    extension: "pptx" | "odp",
  ): Promise<string> {
    if (await this.s3.getFileExists(pdfKey)) return pdfKey;
    const { stream, contentLength } = await this.s3.getFileStream(fileKey);
    if (!(stream instanceof Readable)) throw new Error("Invalid presentation stream");
    const chunks: Buffer[] = [];
    let length = 0;
    const deadline = setTimeout(
      () => stream.destroy(new Error("Presentation stream timed out")),
      S3_OPERATION_TIMEOUT_MS,
    );
    try {
      if (
        contentLength !== undefined &&
        (contentLength <= 0 || contentLength > MAX_PRESENTATION_BYTES)
      ) {
        throw new Error("Invalid presentation length");
      }
      for await (const chunk of stream) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += bytes.length;
        if (length > MAX_PRESENTATION_BYTES) throw new Error("Presentation too large");
        chunks.push(bytes);
      }
      if (length === 0) throw new Error("Empty presentation");
    } finally {
      clearTimeout(deadline);
      stream.destroy();
    }
    const pdf = await this.converter.convert(Buffer.concat(chunks, length), extension);
    if (
      !pdf.length ||
      pdf.length > MAX_PRESENTATION_BYTES ||
      pdf.subarray(0, 5).toString() !== "%PDF-"
    ) {
      throw new Error("Presentation conversion failed");
    }
    await this.s3.uploadFile(pdf, pdfKey, "application/pdf");
    return pdfKey;
  }
}
