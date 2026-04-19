import { stripVoiceControlTags } from "src/ai/utils/voiceControlTags";

describe("stripVoiceControlTags", () => {
  it("removes single xml emotion tags", () => {
    expect(stripVoiceControlTags('<emotion value="happy"/>Hello there')).toBe("Hello there");
  });

  it("removes xml emotion and break tags from one response", () => {
    expect(
      stripVoiceControlTags(
        'First <emotion value="happy"/>sentence.<break time="200ms"/> Second sentence.',
      ),
    ).toBe("First sentence. Second sentence.");
  });

  it("removes the special [laughter] control", () => {
    expect(stripVoiceControlTags("That helps. [laughter] Let us continue.")).toBe(
      "That helps. Let us continue.",
    );
  });

  it("removes spell tags but keeps their content", () => {
    expect(stripVoiceControlTags("Use <spell>zł</spell> only when needed.")).toBe(
      "Use zł only when needed.",
    );
  });

  it("keeps other square bracket text untouched", () => {
    expect(stripVoiceControlTags("Hello [happy and still talking")).toBe(
      "Hello [happy and still talking",
    );
    expect(stripVoiceControlTags("A [joy] B [calm] C")).toBe("A [joy] B [calm] C");
  });

  it("normalizes extra spaces left by removed tags", () => {
    expect(
      stripVoiceControlTags('A <emotion value="neutral"/> B <break time="2s"/> C [laughter] D'),
    ).toBe("A B C D");
  });
});
