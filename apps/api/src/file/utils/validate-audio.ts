import { execFile } from "node:child_process";
import { mkdtemp, open, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { BadRequestException } from "@nestjs/common";
import { AUDIO_UPLOAD_MAX_BYTES, isAudioFile } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { match } from "ts-pattern";

import {
  AAC_LOW_COMPLEXITY_PROFILE,
  AUDIO_DECODE_TIMEOUT_MS,
  AUDIO_DEMUXER_WHITELIST,
  AUDIO_PROBE_TIMEOUT_MS,
  FFPROBE_AUDIO_CODECS,
  FFPROBE_AUDIO_FORMATS,
  M4A_MAJOR_BRANDS,
  VALIDATED_AUDIO_MIME_TYPES,
  type ValidatedAudioMimeType,
} from "src/file/file.constants";
import { audioProbeResultSchema, type AudioProbeResult } from "src/file/types/audio-probe.type";

const execFileAsync = promisify(execFile);

const EBML_ROOT_ID = 0x1a45dfa3;
const EBML_DOC_TYPE_ID = 0x4282;
const WEBM_DOC_TYPE = "webm";
const EBML_HEADER_READ_BYTES = 4096;

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

/** Parses the EBML header DocType, not a byte marker that could appear in Matroska metadata. */
const hasWebmDocType = (buffer: Buffer): boolean => {
  const root = readEbmlInteger(buffer, 0, false);
  if (root.value !== EBML_ROOT_ID) return false;
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
    if (id.value === EBML_DOC_TYPE_ID) {
      if (docType !== undefined) return false;
      docType = buffer.subarray(size.end, next).toString("ascii");
    }
    offset = next;
  }
  return docType === WEBM_DOC_TYPE;
};

const readFileHasWebmDocType = async (filePath: string) => {
  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(EBML_HEADER_READ_BYTES);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return hasWebmDocType(header.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
};

const probeAudioFile = async (filePath: string): Promise<AudioProbeResult> => {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-format_whitelist",
      AUDIO_DEMUXER_WHITELIST,
      "-show_entries",
      "format=format_name,duration:format_tags=major_brand:stream=codec_name,codec_type,profile",
      "-of",
      "json",
      filePath,
    ],
    { timeout: AUDIO_PROBE_TIMEOUT_MS, maxBuffer: 65536, windowsHide: true },
  );
  const probeResult: unknown = JSON.parse(stdout);
  if (!Value.Check(audioProbeResultSchema, probeResult)) throw new Error("Invalid probe output");
  return probeResult;
};

const detectAudioMimeType = async (
  filePath: string,
  { format, streams }: AudioProbeResult,
): Promise<ValidatedAudioMimeType | undefined> => {
  const isAudioOnly = streams.every((stream) => stream.codec_type === "audio");
  if (!isAudioOnly || !(Number(format.duration) > 0)) return undefined;

  const hasOnlyCodecs = (...codecs: string[]) =>
    streams.every((stream) => codecs.includes(stream.codec_name));

  return match(format.format_name)
    .with(FFPROBE_AUDIO_FORMATS.WAV, async () =>
      hasOnlyCodecs(FFPROBE_AUDIO_CODECS.PCM_S16LE) ? VALIDATED_AUDIO_MIME_TYPES.WAV : undefined,
    )
    .with(FFPROBE_AUDIO_FORMATS.MP3, async () =>
      hasOnlyCodecs(FFPROBE_AUDIO_CODECS.MP3) ? VALIDATED_AUDIO_MIME_TYPES.MP3 : undefined,
    )
    .with(FFPROBE_AUDIO_FORMATS.MP4, async () => {
      const hasM4aBrand = (M4A_MAJOR_BRANDS as readonly string[]).includes(
        format.tags?.major_brand ?? "",
      );
      const hasOnlyAacLc = streams.every(
        (stream) =>
          stream.codec_name === FFPROBE_AUDIO_CODECS.AAC &&
          stream.profile === AAC_LOW_COMPLEXITY_PROFILE,
      );
      return hasM4aBrand && hasOnlyAacLc ? VALIDATED_AUDIO_MIME_TYPES.M4A : undefined;
    })
    .with(FFPROBE_AUDIO_FORMATS.OGG, async () =>
      hasOnlyCodecs(FFPROBE_AUDIO_CODECS.VORBIS, FFPROBE_AUDIO_CODECS.OPUS)
        ? VALIDATED_AUDIO_MIME_TYPES.OGG
        : undefined,
    )
    .with(FFPROBE_AUDIO_FORMATS.MATROSKA, async () => {
      if (!hasOnlyCodecs(FFPROBE_AUDIO_CODECS.OPUS)) return undefined;
      return (await readFileHasWebmDocType(filePath)) ? VALIDATED_AUDIO_MIME_TYPES.WEBM : undefined;
    })
    .otherwise(async () => undefined);
};

/** Decodes to the null sink to reject broken packet data; the stored bytes stay unchanged. */
const decodeAudioToNullSink = (filePath: string) =>
  execFileAsync(
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
      "-format_whitelist",
      AUDIO_DEMUXER_WHITELIST,
      "-i",
      filePath,
      "-map",
      "0:a",
      "-f",
      "null",
      "-",
    ],
    { timeout: AUDIO_DECODE_TIMEOUT_MS, maxBuffer: 65536, windowsHide: true },
  );

const assertAudioSize = (size: number) => {
  if (size > AUDIO_UPLOAD_MAX_BYTES) throw new BadRequestException("files.toast.audioFileTooLarge");
  if (!size) throw new BadRequestException("files.toast.invalidData");
};

/**
 * Validates audio stored at `filePath` by probing and decoding its actual content, and returns
 * the canonical MIME type. Never trusts the extension or declared MIME.
 */
export async function validateAudioFileAtPath(
  filePath: string,
  declared: { mimetype: string; originalname: string; size: number },
): Promise<ValidatedAudioMimeType> {
  if (!isAudioFile({ type: declared.mimetype, name: declared.originalname })) {
    throw new BadRequestException("files.toast.invalidData");
  }

  assertAudioSize(declared.size);

  const { size } = await stat(filePath);
  if (size !== declared.size) throw new BadRequestException("files.toast.invalidData");

  try {
    const probeResult = await probeAudioFile(filePath);
    const audioMimeType = await detectAudioMimeType(filePath, probeResult);
    if (!audioMimeType) throw new Error("Unsupported audio");

    await decodeAudioToNullSink(filePath);
    return audioMimeType;
  } catch {
    throw new BadRequestException("files.toast.invalidFileType");
  }
}

/**
 * Validates an in-memory audio upload. ffprobe and ffmpeg need a file, so the bytes are written
 * to a private temporary directory for the duration of the check.
 */
export async function validateAudioUpload(
  file: Express.Multer.File,
): Promise<ValidatedAudioMimeType> {
  if (!file.buffer) throw new BadRequestException("files.toast.invalidData");

  assertAudioSize(file.buffer.length);

  const directory = await mkdtemp(path.join(tmpdir(), "mentingo-audio-"));

  try {
    const filePath = path.join(directory, "upload");
    await writeFile(filePath, file.buffer, { mode: 0o600 });
    return await validateAudioFileAtPath(filePath, {
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.buffer.length,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
