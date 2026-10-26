import { streamVoiceSentenceMarkup } from "src/ai/utils/voice-delivery";

async function* elements(values: unknown[]) {
  yield* values;
}

describe("Native voice sentence streaming", () => {
  it("releases a complete first sentence before the model finishes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = (async function* () {
      yield { cue: "frustrated", text: "Zwrot za ⟦say:sto złotych⟧100 zł⟦/say⟧." };
      await gate;
      yield { cue: "still frustrated", text: "Who can help?" };
    })();
    const stream = streamVoiceSentenceMarkup(source);
    expect((await stream.next()).value).toBe(
      "⟦cue:frustrated⟧Zwrot za ⟦say:sto złotych⟧100 zł⟦/say⟧. ",
    );
    release();
    expect((await stream.next()).value).toBe("⟦cue:still frustrated⟧Who can help? ");
    expect((await stream.next()).done).toBe(true);
  });

  it.each(
    [
      [],
      [{ cue: "[angry]", text: "Hello." }],
      [{ cue: "angry", text: "" }],
      [{ cue: "angry", text: "Hello.", unexpected: true }],
      [{ cue: "x".repeat(129), text: "Hello." }],
      [{ cue: "angry", text: "x".repeat(2049) }],
      [{ cue: "angry", text: "⟦cue:neutral⟧Hello." }],
      Array.from({ length: 13 }, () => ({ cue: "angry", text: "Hello." })),
    ].map((values) => ({ values })),
  )("rejects malformed or unbounded elements %#", async ({ values }) => {
    const run = async () => {
      for await (const _part of streamVoiceSentenceMarkup(elements(values))) {
        /* consume */
      }
    };
    await expect(run()).rejects.toThrow("VOICE_DELIVERY_INVALID");
  });

  it("closes the source and skips final validation after cancellation", async () => {
    const controller = new AbortController();
    let closed = false;
    const validate = jest.fn();
    const source = (async function* () {
      try {
        yield { cue: "angry", text: "First." };
        controller.abort();
        yield { cue: "angry", text: "Second." };
      } finally {
        closed = true;
      }
    })();
    const received = [];
    for await (const text of streamVoiceSentenceMarkup(source, controller.signal, validate))
      received.push(text);
    expect(received).toEqual(["⟦cue:angry⟧First. "]);
    expect(closed).toBe(true);
    expect(validate).not.toHaveBeenCalled();
  });

  it("rejects a malformed final envelope after previously valid sentences", async () => {
    const validate = async () => {
      throw new Error("invalid final envelope");
    };
    const stream = streamVoiceSentenceMarkup(
      elements([{ cue: "angry", text: "First." }]),
      undefined,
      validate,
    );
    expect((await stream.next()).value).toBe("⟦cue:angry⟧First. ");
    await expect(stream.next()).rejects.toThrow("invalid final envelope");
  });
});
