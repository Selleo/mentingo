import { applyFormats } from "nestjs-typebox";

import { setupValidation } from "../src/utils/setup-validation";

const originalLog = console.log;

// Custom log filter function
const filteredLog = (...args: any[]) => {
  if (
    args.some(
      (arg) =>
        typeof arg === "object" &&
        arg !== null &&
        (arg.severity_local === "NOTICE" || arg.severity === "NOTICE"),
    )
  ) {
    return;
  }

  originalLog(...args);
};

beforeAll(async () => {
  applyFormats();
  setupValidation();
  if (!process.env.MASTER_KEY) {
    // 32-byte deterministic test key
    process.env.MASTER_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
  }
  jest.spyOn(console, "log").mockImplementation(filteredLog);
});

afterAll(() => {
  jest.restoreAllMocks;
});
