import { execFileSync } from "node:child_process";
import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateAudioUpload } from "./validate-audio";

describe("actual-content audio validation", () => {
  let directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "lesson-audio-test-"));
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      path.join(directory, "audio.wav"),
    ]);
  });
  afterAll(async () => rm(directory, { recursive: true, force: true }));

  it("rejects Matroska containing a forged WebM marker outside its EBML DocType", async () => {
    const filePath = path.join(directory, "forged.mka");
    const comment = "FORGED_WEBM_MARKER_PADDING";
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      "-c:a",
      "libopus",
      "-metadata",
      `comment=${comment}`,
      filePath,
    ]);
    const bytes = await readFile(filePath);
    const offset = bytes.indexOf(Buffer.from(comment));
    expect(offset).toBeGreaterThan(0);
    Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]).copy(bytes, offset);
    await writeFile(filePath, bytes);
    await expect(
      validateAudioUpload({
        path: filePath,
        originalname: "forged.webm",
        mimetype: "audio/webm",
        size: bytes.length,
      } as Express.Multer.File),
    ).rejects.toThrow();
  });

  it("rejects corrupted AAC packet data even when ffprobe recognizes valid M4A headers", async () => {
    const filePath = path.join(directory, "corrupted.m4a");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      "-c:a",
      "aac",
      filePath,
    ]);
    const bytes = await readFile(filePath);
    const offset = bytes.indexOf(Buffer.from("mdat"));
    expect(offset).toBeGreaterThan(0);
    const length = bytes.readUInt32BE(offset - 4);
    bytes.fill(0, offset + 4, offset - 4 + length);
    await writeFile(filePath, bytes);
    await expect(
      validateAudioUpload({
        path: filePath,
        originalname: "audio.m4a",
        mimetype: "audio/mp4",
        size: bytes.length,
      } as Express.Multer.File),
    ).rejects.toThrow();
  });

  it("reports the shared audio size limit without reading the podcast into memory", async () => {
    const filePath = path.join(directory, "oversized.wav");
    const handle = await open(filePath, "w");
    await handle.truncate(209715201);
    await handle.close();
    await expect(
      validateAudioUpload({
        path: filePath,
        originalname: "oversized.wav",
        mimetype: "audio/wav",
        size: 209715201,
      } as Express.Multer.File),
    ).rejects.toThrow("files.toast.audioFileTooLarge");
  });

  it("rejects a MOV container even if its audio codec is AAC", async () => {
    const filePath = path.join(directory, "unsupported.mov");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      "-c:a",
      "aac",
      filePath,
    ]);
    await expect(
      validateAudioUpload({
        path: filePath,
        originalname: "spoofed.m4a",
        mimetype: "audio/mp4",
        size: (await stat(filePath)).size,
      } as Express.Multer.File),
    ).rejects.toThrow();
  });

  it("rejects floating-point WAV rather than advertising browser-unsupported PCM variants", async () => {
    const filePath = path.join(directory, "unsupported-float.wav");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      "-c:a",
      "pcm_f64le",
      filePath,
    ]);
    await expect(
      validateAudioUpload({
        path: filePath,
        originalname: "audio.wav",
        mimetype: "audio/wav",
        size: (await stat(filePath)).size,
      } as Express.Multer.File),
    ).rejects.toThrow();
  });

  it("rejects a non-audio browser MIME rather than weakening image validation", async () => {
    const filePath = path.join(directory, "audio.wav");
    await expect(
      validateAudioUpload({
        path: filePath,
        originalname: "audio.wav",
        mimetype: "image/png",
        size: (await stat(filePath)).size,
      } as Express.Multer.File),
    ).rejects.toThrow();
  });

  it.each([
    ["mp3", "libmp3lame", "audio/mp3", "audio/mpeg"],
    ["m4a", "aac", "audio/x-m4a", "audio/mp4"],
    ["ogg", "libvorbis", "application/ogg", "audio/ogg"],
    ["opus", "libopus", "audio/ogg", "audio/ogg"],
    ["webm", "libopus", "audio/webm", "audio/webm"],
  ])("validates real %s data", async (extension, codec, browserMime, canonicalMime) => {
    const filePath = path.join(directory, `audio.${extension}`);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      "-c:a",
      codec,
      filePath,
    ]);
    const file = {
      path: filePath,
      originalname: `audio.${extension}`,
      mimetype: browserMime,
      size: (await stat(filePath)).size,
    } as Express.Multer.File;
    await validateAudioUpload(file);
    expect(file.mimetype).toBe(canonicalMime);
  });

  it.each([
    ["aac", "aac"],
    ["m4a", "alac"],
    ["wav", "adpcm_ima_wav"],
    ["mka", "libopus"],
  ])("rejects unsupported %s / %s", async (extension, codec) => {
    const filePath = path.join(directory, `unsupported.${extension}`);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      "-c:a",
      codec,
      filePath,
    ]);
    await expect(
      validateAudioUpload({
        path: filePath,
        originalname: "spoofed.mp3",
        mimetype: "audio/mpeg",
        size: (await stat(filePath)).size,
      } as Express.Multer.File),
    ).rejects.toThrow();
  });

  it("validates disk-backed PCM WAV with an empty browser MIME and canonicalizes it", async () => {
    const file = {
      path: path.join(directory, "audio.wav"),
      originalname: "audio.wav",
      mimetype: "",
      size: (await stat(path.join(directory, "audio.wav"))).size,
    } as Express.Multer.File;
    await validateAudioUpload(file);
    expect(file.mimetype).toBe("audio/wav");
    expect(file.buffer).toBeUndefined();
  });
});
