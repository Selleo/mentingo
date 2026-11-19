import type { BrowserContext, Page } from "@playwright/test";
import type { UserRole } from "~/config/userRoles";

export type PageHandle = {
  context: BrowserContext;
  origin?: string;
  page: Page;
};

export type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

export type WithWorkerPage = (
  role: UserRole,
  run: (handle: PageHandle) => Promise<void>,
  options?: { root?: boolean },
) => Promise<void>;
