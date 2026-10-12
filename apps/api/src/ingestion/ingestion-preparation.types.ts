export interface PreparedIngestionDocument {
  filename: string;
  byteSize: number;
  contentType: string;
  checksum: string;
  metadata?: Record<string, unknown>;
  chunks: { content: string; metadata: unknown; embedding: number[] }[];
}
