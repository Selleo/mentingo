import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test/jest-console-setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/jest-setup.ts"],
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
  },
  modulePaths: ["."],
  testTimeout: 30000,
  maxWorkers: 1,
  forceExit: true,
};

export default config;
