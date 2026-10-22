import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { BadRequestException, Injectable } from "@nestjs/common";
import { TextLoader } from "langchain/document_loaders/fs/text";

import {
  ALLOWED_FILE_TYPES_MAP,
  MAX_MB_PER_FILE,
  SEARCH_FILE_TYPES_MAP,
  SEARCH_EXTRACTABLE_FILE_TYPES,
} from "src/ingestion/ingestion.config";

import { CsvSearchLoader, SpreadsheetLoader, validateOfficeArchive } from "./search-file.loaders";

import type { TextExtractionBody } from "src/ingestion/ingestion.schema";

@Injectable()
export class ChunkService {
  constructor() {}

  async extractText(file: Express.Multer.File): Promise<TextExtractionBody> {
    const fileBlob = new Blob([new Uint8Array(file.buffer)], { type: file?.mimetype });
    switch (file.mimetype) {
      case ALLOWED_FILE_TYPES_MAP.PDF: {
        const loader = new PDFLoader(fileBlob);
        return loader.load();
      }

      case ALLOWED_FILE_TYPES_MAP.DOCX: {
        const loader = new DocxLoader(fileBlob);
        return loader.load();
      }

      case ALLOWED_FILE_TYPES_MAP.TXT: {
        const loader = new TextLoader(fileBlob);
        return loader.load();
      }

      default: {
        throw new BadRequestException("This filetype is not allowed");
      }
    }
  }

  /** Extract supported search attachments without widening the ingestion upload policy. */
  async extractSearchText(file: Express.Multer.File): Promise<TextExtractionBody> {
    if (file.buffer.length > MAX_MB_PER_FILE * 1024 * 1024) {
      throw new BadRequestException("Search attachment exceeds the extraction size limit");
    }
    if (!SEARCH_EXTRACTABLE_FILE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("This filetype is not supported for search extraction");
    }
    const fileBlob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    switch (file.mimetype) {
      case SEARCH_FILE_TYPES_MAP.PPTX:
        validateOfficeArchive(file.buffer);
        return new PPTXLoader(fileBlob).load();
      case SEARCH_FILE_TYPES_MAP.XLSX:
        validateOfficeArchive(file.buffer);
        return new SpreadsheetLoader(fileBlob).load();
      case SEARCH_FILE_TYPES_MAP.CSV:
        return new CsvSearchLoader(fileBlob).load();
      case SEARCH_FILE_TYPES_MAP.DOCX:
        validateOfficeArchive(file.buffer);
        return this.extractText(file);
      default:
        return this.extractText(file);
    }
  }

  async chunkPages(pages: TextExtractionBody): Promise<TextExtractionBody> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 256,
      chunkOverlap: 0,
    });

    return splitter.splitDocuments(pages);
  }
}
