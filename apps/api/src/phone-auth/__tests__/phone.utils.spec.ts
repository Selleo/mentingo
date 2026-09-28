import { maskPhone, normalizePhone, toSmsRuRecipient } from "src/phone-auth/phone.utils";

describe("normalizePhone", () => {
  it.each([
    ["+79161234567", "+79161234567"],
    ["+7 (916) 123-45-67", "+79161234567"],
    ["89161234567", "+79161234567"],
    ["8 916 123 45 67", "+79161234567"],
    ["9161234567", "+79161234567"],
    ["  7 916 123-45-67 ", "+79161234567"],
    ["0079161234567", "+79161234567"],
  ])("normalizes Russian number %p to E.164", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["+97688112233", "+97688112233"],
    ["+976 9911 2233", "+97699112233"],
    ["99112233", "+97699112233"],
  ])("normalizes Mongolian number %p to E.164", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("accepts Kazakhstan numbers that share the +7 calling code", () => {
    expect(normalizePhone("+77011234567")).toBe("+77011234567");
  });

  it.each([
    [""],
    ["   "],
    ["12345"],
    ["+7 123"],
    ["not a phone"],
    ["+79161234567; DROP TABLE users"],
    ["+7916123456789012345678901234567890"],
  ])("rejects invalid input %p", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("rejects numbers from countries outside the allow-list", () => {
    expect(normalizePhone("+380501234567")).toBeNull();
    expect(normalizePhone("+14155552671")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("keeps only the calling code and the last four digits", () => {
    expect(maskPhone("+79161234567")).toBe("+7******4567");
    expect(maskPhone("+97688112233")).toBe("+976****2233");
  });

  it("never returns the full number", () => {
    const phone = "+79161234567";

    expect(maskPhone(phone)).not.toContain("916123");
  });

  it("handles empty values", () => {
    expect(maskPhone(null)).toBe("<empty>");
    expect(maskPhone("")).toBe("<empty>");
  });
});

describe("toSmsRuRecipient", () => {
  it("strips everything except digits", () => {
    expect(toSmsRuRecipient("+79161234567")).toBe("79161234567");
  });
});
