import {
  LOGIN_PAGE_HANDLES,
  MAGIC_LINK_PAGE_HANDLES,
  PASSWORD_RECOVERY_PAGE_HANDLES,
  REGISTER_PAGE_HANDLES,
} from "../data/auth/handles";
import { TOAST_HANDLES } from "../data/common/handles";
import { expect, test } from "../fixtures/test.fixture";
import { fillLoginFormFlow } from "../flows/auth/fill-login-form.flow";
import { submitLoginFormFlow } from "../flows/auth/submit-login-form.flow";

import { openAndScanView, scanView, type AuditedView } from "./scan-view";
import { AUDIT_ROLE } from "./wcag-audit.types";

const VISITOR_VIEWS: AuditedView[] = [
  {
    viewId: "auth-register",
    viewName: "Register",
    path: "/auth/register",
    ready: (page) => page.getByTestId(REGISTER_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "auth-password-recovery",
    viewName: "Password recovery",
    path: "/auth/password-recovery",
    ready: (page) => page.getByTestId(PASSWORD_RECOVERY_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "auth-magic-link",
    viewName: "Magic link sign-in",
    path: "/auth/magic-link",
    ready: (page) => page.getByTestId(MAGIC_LINK_PAGE_HANDLES.PAGE),
  },
];

test("visitor sign-in path and auth pages", async ({ cleanup, createWorkspacePage }) => {
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());
  await page.emulateMedia({ reducedMotion: "reduce" });

  await openAndScanView(page, AUDIT_ROLE.ANONYMOUS, {
    viewId: "auth-login",
    viewName: "Login",
    path: "/auth/login",
    ready: (currentPage) => currentPage.getByTestId(LOGIN_PAGE_HANDLES.PAGE),
  });

  // Error state: both fields invalid after an empty submit.
  await submitLoginFormFlow(page);
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.EMAIL)).toHaveClass(/border-red-500/);
  await scanView(page, {
    viewId: "auth-login-validation-errors",
    viewName: "Login with validation errors",
    role: AUDIT_ROLE.ANONYMOUS,
    layoutAndKeyboardChecks: false,
  });

  await fillLoginFormFlow(page, `unknown-${Date.now()}@example.com`, "wrong-password-1A!");
  await submitLoginFormFlow(page);
  await expect(page.getByTestId(TOAST_HANDLES.ROOT).first()).toBeVisible();
  await scanView(page, {
    viewId: "auth-login-wrong-credentials",
    viewName: "Login with wrong credentials",
    role: AUDIT_ROLE.ANONYMOUS,
    layoutAndKeyboardChecks: false,
  });

  for (const view of VISITOR_VIEWS) {
    await openAndScanView(page, AUDIT_ROLE.ANONYMOUS, view);
  }
});
