import { AUDIO_UPLOAD_MAX_BYTES, isAudioFile } from "@repo/shared";

describe("lesson audio upload contract", () => {
  it("shares browser aliases and an explicit bounded upload limit", () => {
    expect(AUDIO_UPLOAD_MAX_BYTES).toBe(209715200);
    expect(isAudioFile({ type: "audio/x-m4a", name: "episode.m4a" })).toBe(true);
    expect(isAudioFile({ type: "", name: "episode.MP3" })).toBe(true);
    expect(isAudioFile({ type: "application/octet-stream", name: "episode.ogg" })).toBe(true);
    expect(isAudioFile({ type: "image/png", name: "episode.mp3" })).toBe(false);
    expect(isAudioFile({ type: "audio/aac", name: "episode.aac" })).toBe(false);
  });
});
