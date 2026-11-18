import { authenticateContext } from "../fixtures/auth.actions";

import { createFixtureApiClient } from "./api-client";
import { markAllOnboardingComplete } from "./onboarding";

import type { CreateWorkspaceContext } from "../fixtures/test.fixture";

type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

type OpenLearnerPageInput = {
  cleanup: Cleanup;
  createWorkspaceContext: CreateWorkspaceContext;
  email: string;
  password: string;
};

/** Signs a dedicated (non-worker) user into the worker tenant and returns a page in that session. */
export const openLearnerPage = async ({
  cleanup,
  createWorkspaceContext,
  email,
  password,
}: OpenLearnerPageInput) => {
  const { context, origin } = await createWorkspaceContext();
  cleanup.add(() => context.close());

  await authenticateContext(context, origin, email, password);

  const learnerClient = createFixtureApiClient();
  await learnerClient.syncFromContext(context, origin);
  await markAllOnboardingComplete(learnerClient);

  return context.newPage();
};
