import { applyFormats } from "nestjs-typebox";

import { setupValidation } from "../src/utils/setup-validation";

import { closeTestDatabase } from "./test-database";

const originalLog = console.log;

// Custom log filter function - filter only PostgreSQL NOTICE logs
const filteredLog = (...args: any[]) => {
  if (
    args.some(
      (arg) =>
        typeof arg === "object" &&
        arg !== null &&
        (arg.severity_local === "NOTICE" || arg.severity === "NOTICE") &&
        (arg.message?.includes("truncate") || arg.message?.includes("cascade")),
    )
  ) {
    return;
  }

  originalLog(...args);
};

beforeAll(async () => {
  applyFormats();
  setupValidation();
  jest.spyOn(console, "log").mockImplementation(filteredLog);
});

afterAll(async () => {
  await closeTestDatabase();
  jest.restoreAllMocks();
});
