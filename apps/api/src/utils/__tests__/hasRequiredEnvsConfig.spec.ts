import { hasRequiredEnvsConfig } from "src/utils/hasRequiredEnvsConfig";

describe("hasRequiredEnvsConfig", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  it("should return true if all specified envs exist", () => {
    process.env.A = "test";
    expect(hasRequiredEnvsConfig(["A"])).toBe(true);

    process.env.B = "test";
    expect(hasRequiredEnvsConfig(["A", "B"])).toBe(true);
  });

  it("should return false if one of the specified envs does not exist", () => {
    expect(hasRequiredEnvsConfig(["A"])).toBe(false);

    process.env.A = "test";
    expect(hasRequiredEnvsConfig(["A", "B"])).toBe(false);
  });

  it("should return true if specified envs array is empty", () => {
    expect(hasRequiredEnvsConfig([])).toBe(true);
  });

  it("should return false if one of the envs is an empty string", () => {
    process.env.A = "";
    expect(hasRequiredEnvsConfig(["A"])).toBe(false);
  });
});
