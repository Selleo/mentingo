import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Value } from "@sinclair/typebox/value";

import { fakeDirectoryWorkspaceSchema, type FakeDirectoryWorkspace } from "./fake-directory.schema";

export function readFakeDirectoryWorkspace(fixturePath: string): FakeDirectoryWorkspace {
  const resolvedPath = resolve(fixturePath);
  const workspace: unknown = JSON.parse(readFileSync(resolvedPath, "utf8"));

  if (!Value.Check(fakeDirectoryWorkspaceSchema, workspace)) {
    throw new Error(`Fake directory fixture ${resolvedPath} does not match the expected shape`);
  }

  return workspace;
}
