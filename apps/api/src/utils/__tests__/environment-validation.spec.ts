import { environmentValidation } from "../environment-validation";

describe("environmentValidation", () => {
  it("returns 'production' for production environment", () => {
    expect(environmentValidation("production")).toBe("production");
  });

  it("returns 'staging' for staging environment", () => {
    expect(environmentValidation("staging")).toBe("staging");
  });

  it("returns 'development' for development environment", () => {
    expect(environmentValidation("development")).toBe("development");
  });

  it("returns 'development' for unknown environment", () => {
    expect(environmentValidation("unknown")).toBe("development");
    expect(environmentValidation("test")).toBe("development");
    expect(environmentValidation("local")).toBe("development");
  });

  it("returns 'development' for empty string", () => {
    expect(environmentValidation("")).toBe("development");
  });

  it("is case sensitive", () => {
    expect(environmentValidation("Production")).toBe("development");
    expect(environmentValidation("PRODUCTION")).toBe("development");
    expect(environmentValidation("Staging")).toBe("development");
  });
});
