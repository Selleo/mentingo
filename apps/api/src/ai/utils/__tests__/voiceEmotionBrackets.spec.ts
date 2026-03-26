import { stripVoiceEmotionBrackets } from "src/ai/utils/voiceEmotionBrackets";

describe("stripVoiceEmotionBrackets", () => {
  it("removes single emotion tags", () => {
    expect(stripVoiceEmotionBrackets("[happy]Hello there")).toBe("Hello there");
  });

  it("removes multiple emotion tags from one response", () => {
    expect(stripVoiceEmotionBrackets("First [happy]sentence. [sad]Second sentence.")).toBe(
      "First sentence. Second sentence.",
    );
  });

  it("keeps unmatched brackets as literal text", () => {
    expect(stripVoiceEmotionBrackets("Hello [happy and still talking")).toBe(
      "Hello [happy and still talking",
    );
    expect(stripVoiceEmotionBrackets("Hello happy] and still talking")).toBe(
      "Hello happy] and still talking",
    );
  });

  it("removes any valid bracket token in the middle of text", () => {
    expect(stripVoiceEmotionBrackets("A [joy] B [calm] C")).toBe("A  B  C");
  });
});
