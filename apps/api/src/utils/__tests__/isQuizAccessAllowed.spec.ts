import { isQuizAccessAllowed } from "src/utils/isQuizAccessAllowed";

describe("isQuizAccessAllowed", () => {
  it("should return true if number of attempts or attempts limit is null", () => {
    expect(isQuizAccessAllowed(null, null, new Date().toString(), 1)).toBe(true);
    expect(isQuizAccessAllowed(null, 3, new Date().toString(), 1)).toBe(true);
    expect(isQuizAccessAllowed(1, null, new Date().toString(), 1)).toBe(true);
    expect(isQuizAccessAllowed(1, null, null, null)).toBe(true);
  });

  it("should return true if number of attempts is not multiplication of attempts limit", () => {
    expect(isQuizAccessAllowed(1, 3, new Date().toString(), 1)).toBe(true);
    expect(isQuizAccessAllowed(5, 3, new Date().toString(), 1)).toBe(true);
    expect(isQuizAccessAllowed(7, 3, null, null)).toBe(true);
  });

  it("should return false if number of attempts is a multiplication of attempts limit and cooldown not yet passed", () => {
    expect(isQuizAccessAllowed(0, 3, new Date().toString(), 1)).toBe(false);
    expect(isQuizAccessAllowed(3, 3, new Date().toString(), 1)).toBe(false);
    const lastUpdate = new Date(Date.now() - 30 * 60 * 1000).toString(); // 30 minutes ago
    expect(isQuizAccessAllowed(6, 3, lastUpdate, 1)).toBe(false);
  });

  it("should return true if number of attempts is a multiplication of attempts limit and cooldown passed", () => {
    const lastUpdate = new Date(Date.now() - 2 * 60 * 60 * 1000).toString(); // 2 hours ago
    expect(isQuizAccessAllowed(3, 3, lastUpdate, 1)).toBe(true);
    expect(isQuizAccessAllowed(6, 3, lastUpdate, 1)).toBe(true);
  });

  it("should return true if number of attempts is a multiplication of attemps limit and last update is 0 or null", () => {
    expect(isQuizAccessAllowed(3, 3, "0", 1)).toBe(true);
    expect(isQuizAccessAllowed(3, 3, null, 1)).toBe(true);
  });

  it("should return true if number of attempts is a multiplication of attemps limit and cooldown is 0 or null", () => {
    expect(isQuizAccessAllowed(3, 3, new Date().toString(), 0)).toBe(true);
    expect(isQuizAccessAllowed(3, 3, new Date().toString(), null)).toBe(true);
  });

  it("should return false if number of attempts limit is 1", () => {
    expect(isQuizAccessAllowed(0, 1, new Date().toString(), 1)).toBe(false);
    expect(isQuizAccessAllowed(1, 1, new Date().toString(), 1)).toBe(false);
    expect(isQuizAccessAllowed(4, 1, new Date().toString(), 1)).toBe(false);
  });
});
