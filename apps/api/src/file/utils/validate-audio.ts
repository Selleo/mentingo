import { execFile } from "node:child_process";
import { open, stat } from "node:fs/promises";
import { promisify } from "node:util";

import { BadRequestException } from "@nestjs/common";
import { AUDIO_UPLOAD_MAX_BYTES, isAudioFile } from "@repo/shared";

const probe = promisify(execFile);

const readEbmlInteger = (buffer: Buffer, offset: number, stripMarker: boolean) => {
  let width = 1;
  let marker = 0x80;
  while (width <= 8 && !(buffer[offset] & marker)) {
    width += 1;
    marker >>= 1;
  }
  if (width > 8 || offset + width > buffer.length) throw new Error("Invalid EBML integer");
  let value = buffer[offset];
  if (stripMarker) value &= marker - 1;
  for (let index = 1; index < width; index += 1) value = value * 256 + buffer[offset + index];
  if (!Number.isSafeInteger(value)) throw new Error("Invalid EBML size");
  return { value, end: offset + width };
};

const hasWebmDocType = (buffer: Buffer): boolean => {
  const root = readEbmlInteger(buffer, 0, false);
  if (root.value !== 0x1a45dfa3) return false;
  const rootSize = readEbmlInteger(buffer, root.end, true);
  const end = rootSize.end + rootSize.value;
  if (end > buffer.length) return false;
  let offset = rootSize.end;
  let docType: string | undefined;
  while (offset < end) {
    const id = readEbmlInteger(buffer, offset, false);
    const size = readEbmlInteger(buffer, id.end, true);
    const next = size.end + size.value;
    if (next > end) return false;
    if (id.value === 0x4282) {
      if (docType !== undefined) return false;
      docType = buffer.subarray(size.end, next).toString("ascii");
    }
    offset = next;
  }
  return docType === "webm";
};

/** Probe only a local, bounded upload. Never trust its extension or browser MIME. */
export async function validateAudioUpload(file: Express.Multer.File): Promise<void> {
  if (!file.path || !isAudioFile({ type: file.mimetype, name: file.originalname })) {
    throw new BadRequestException("files.toast.invalidData");
  }
  const size = (await stat(file.path)).size;
  if (size > AUDIO_UPLOAD_MAX_BYTES) throw new BadRequestException("files.toast.audioFileTooLarge");
  if (!size || size !== file.size) {
    throw new BadRequestException("files.toast.invalidData");
  }
  try {
    const { stdout } = await probe(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-show_entries",
        "format=format_name,duration:format_tags=major_brand:stream=codec_name,codec_type,profile",
        "-of",
        "json",
        file.path,
      ],
      { timeout: 15000, maxBuffer: 65536, windowsHide: true },
    );
    const result = JSON.parse(stdout);
    if (
      !result.streams?.length ||
      !result.streams.every((stream: { codec_type: string }) => stream.codec_type === "audio")
    ) {
      throw new Error("Not audio-only");
    }
    const format = result.format?.format_name;
    const codecs: string[] = result.streams.map(
      (stream: { codec_name: string }) => stream.codec_name,
    );
    let mime: string | undefined;
    if (format === "wav" && codecs.every((codec) => codec === "pcm_s16le")) mime = "audio/wav";
    if (format === "mp3" && codecs.every((codec) => codec === "mp3")) mime = "audio/mpeg";
    if (
      format === "mov,mp4,m4a,3gp,3g2,mj2" &&
      ["M4A ", "isom", "iso2", "mp41", "mp42"].includes(result.format?.tags?.major_brand) &&
      result.streams.every(
        (stream: { codec_name: string; profile: string }) =>
          stream.codec_name === "aac" && stream.profile === "LC",
      )
    )
      mime = "audio/mp4";
    if (format === "ogg" && codecs.every((codec) => ["vorbis", "opus"].includes(codec)))
      mime = "audio/ogg";
    if (format === "matroska,webm" && codecs.every((codec) => codec === "opus")) {
      const handle = await open(file.path, "r");
      try {
        const header = Buffer.alloc(4096);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        // Parse the EBML header, not a byte marker that could appear in Matroska metadata.
        if (hasWebmDocType(header.subarray(0, bytesRead))) mime = "audio/webm";
      } finally {
        await handle.close();
      }
    }
    if (!mime || !(Number(result.format?.duration) > 0)) throw new Error("Unsupported audio");
    // Decode to the null sink to reject broken packet data, not merely plausible headers.
    // The original bytes are stored unchanged; this is validation, not a transcoding job.
    await probe(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-xerror",
        "-err_detect",
        "explode",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file",
        "-i",
        file.path,
        "-map",
        "0:a",
        "-f",
        "null",
        "-",
      ],
      { timeout: 120000, maxBuffer: 65536, windowsHide: true },
    );
    file.mimetype = mime;
  } catch {
    throw new BadRequestException("files.toast.invalidFileType");
  }
}
