import { VoiceMarkupDisplayParser } from "src/ai/utils/voiceControlTags";

import { streamVoiceSentenceMarkup } from "./voice-delivery";
import { VoiceDeliveryParser } from "./voice-delivery-parser";

async function* fragments(values: string[]) {
  yield* values;
}

async function collect(values: string[]) {
  const output: string[] = [];
  for await (const delta of streamVoiceSentenceMarkup(fragments(values))) output.push(delta);
  return output.join("");
}

const envelope = (elements: unknown[]) => JSON.stringify({ elements });

describe("Incremental voice sentence delivery", () => {
  it("releases text while the provider is blocked inside its first sentence", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = (async function* () {
      yield '{"elements":[{"cue":"frustrated","text":"I waited';
      await gate;
      yield '."},{"cue":"still frustrated","text":"Who can help?"}]}';
    })();
    const stream = streamVoiceSentenceMarkup(source);
    const first = await stream.next();
    expect(first.value).toBe("⟦cue:frustrated⟧I waited");
    release?.();
    expect((await stream.next()).value).toBe(". ⟦cue:still frustrated⟧Who can help? ");
    expect((await stream.next()).done).toBe(true);
  });

  it("buffers text before cue instead of choosing a delivery direction", async () => {
    const parser = new VoiceDeliveryParser();
    expect(parser.feed('{"elements":[{"text":"Already known.","cue":"frus')).toBe("");
    expect(parser.feed('trated"}]}')).toBe("⟦cue:frustrated⟧Already known. ");
    parser.finish();
  });

  it("preserves Unicode, escapes, controls and spaces at every split", async () => {
    const text =
      '  Zażółć 😀 "cytat" \\ ścieżka\n⟦say:sto złotych⟧100 zł⟦/say⟧ i ⟦spell⟧AI⟦/spell⟧.  ';
    const raw = envelope([{ cue: " calm ", text }]).replace("😀", "\\ud83d\\ude00");
    const expected = `⟦cue:calm⟧${text.trim()} `;
    for (let split = 0; split <= raw.length; split += 1) {
      expect(await collect([raw.slice(0, split), raw.slice(split)])).toBe(expected);
    }
    expect(await collect(raw.split(""))).toBe(expected);
  });

  it("never emits a half Unicode surrogate", () => {
    const parser = new VoiceDeliveryParser();
    expect(parser.feed('{"elements":[{"cue":"calm","text":"\\ud83d')).toBe("");
    expect(parser.feed("\\ude00")).toBe("⟦cue:calm⟧😀");
    expect(parser.feed('"}]}')).toBe(" ");
    parser.finish();
  });

  it("joins literal Unicode surrogate halves split between fragments", async () => {
    expect(await collect(envelope([{ cue: "calm", text: "😀" }]).split(""))).toBe("⟦cue:calm⟧😀 ");
  });

  it.each(["⟦cue:", "⟦emotion:"])("does not forward a split forbidden %s control", (control) => {
    const parser = new VoiceDeliveryParser();
    const delivered: string[] = [];
    delivered.push(parser.feed('{"elements":[{"cue":"calm","text":"Safe '));
    expect(() => {
      for (const character of control) delivered.push(parser.feed(character));
    }).toThrow("VOICE_DELIVERY_INVALID");
    expect(delivered.join("")).toBe("⟦cue:calm⟧Safe");
  });

  it("keeps pronunciation controls usable by the incremental display parser", async () => {
    const text = "Zwrot za ⟦say:sto złotych⟧100 zł⟦/say⟧.";
    const parser = new VoiceMarkupDisplayParser();
    let display = "";
    for await (const delta of streamVoiceSentenceMarkup(
      fragments(envelope([{ cue: "calm", text }]).split("")),
    )) {
      display += parser.push(delta);
    }
    display += parser.finish();
    expect(display).toBe("Zwrot za 100 zł. ");
  });

  it.each([
    envelope([]),
    envelope([{ cue: "[angry]", text: "Hello." }]),
    envelope([{ cue: "", text: "Hello." }]),
    envelope([{ cue: "angry", text: "" }]),
    envelope([{ cue: "angry", text: "Hello.", unexpected: true }]),
    envelope([{ cue: "x".repeat(129), text: "Hello." }]),
    envelope([{ cue: "angry", text: "x".repeat(2049) }]),
    envelope(Array.from({ length: 13 }, () => ({ cue: "angry", text: "Hello." }))),
    '{"elements":[{"cue":"calm","cue":"angry","text":"Hello."}]}',
    '{"elements":[{"cue":"calm","text":"Hello.",}]}',
    '{"elements":[{"cue":"calm","text":"Hello."},]}',
    '{"elements":[{"cue":"calm","text":"bad\\q"}]}',
    '{"elements":[{"cue":"calm","text":"bad\\uQQQQ"}]}',
    '{"elements":[{"cue":"calm","text":"bad\\ud83d"}]}',
    '{"elements":[{"cue":"calm","text":"bad\\ude00"}]}',
    '{"elements":[{"cue":"calm","text":"bad\\ud83dX"}]}',
    '{"elements":[{"cue":"calm","text":"bad\n"}]}',
    '{"elements":[{"cue":"calm","text":"Hello."}],"extra":1}',
    '{"elements":[{"cue":"calm","text":"Hello."}]}garbage',
    '{"elements":[{"cue":"calm","text":"unfinished',
    " ".repeat(200_001),
  ])("rejects malformed, incomplete or unbounded output %#", async (raw) => {
    await expect(collect([raw])).rejects.toThrow("VOICE_DELIVERY_INVALID");
  });

  it("fails a truncated suffix after already emitting a prefix", async () => {
    const stream = streamVoiceSentenceMarkup(
      fragments(['{"elements":[{"cue":"calm","text":"Hello']),
    );
    expect((await stream.next()).value).toBe("⟦cue:calm⟧Hello");
    await expect(stream.next()).rejects.toThrow("VOICE_DELIVERY_INVALID");
  });

  it("closes the source and skips final validation after cancellation", async () => {
    const controller = new AbortController();
    let closed = false;
    const validate = jest.fn();
    const source = (async function* () {
      try {
        yield '{"elements":[{"cue":"calm","text":"First';
        controller.abort();
        yield ' sentence."}]}';
      } finally {
        closed = true;
      }
    })();
    const delivered: string[] = [];
    for await (const delta of streamVoiceSentenceMarkup(source, controller.signal, validate))
      delivered.push(delta);
    expect(delivered).toEqual(["⟦cue:calm⟧First"]);
    expect(closed).toBe(true);
    expect(validate).not.toHaveBeenCalled();
  });

  it("closes upstream when a downstream consumer stops", async () => {
    let closed = false;
    const source = (async function* () {
      try {
        yield '{"elements":[{"cue":"calm","text":"First';
        yield ' sentence."}]}';
      } finally {
        closed = true;
      }
    })();
    const stream = streamVoiceSentenceMarkup(source);
    await stream.next();
    await stream.return(undefined);
    expect(closed).toBe(true);
  });

  it("retains SDK completion validation after progressive delivery", async () => {
    const validate = jest.fn().mockRejectedValue(new Error("SDK envelope invalid"));
    const stream = streamVoiceSentenceMarkup(
      fragments([envelope([{ cue: "calm", text: "Hello." }])]),
      undefined,
      validate,
    );
    expect((await stream.next()).value).toBe("⟦cue:calm⟧Hello. ");
    await expect(stream.next()).rejects.toThrow("SDK envelope invalid");
  });
});
