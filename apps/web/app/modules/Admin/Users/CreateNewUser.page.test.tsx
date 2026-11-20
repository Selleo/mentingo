import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CREATE_USER_PAGE_HANDLES } from "../../../../e2e/data/users/handles";

import CreateNewUserPage from "./CreateNewUser.page";

import type { ReactNode } from "react";

const { createUser } = vi.hoisted(() => ({
  createUser: vi.fn().mockResolvedValue({ data: { id: "created-user" } }),
}));

vi.mock("~/api/mutations/admin/useCreateUser", () => ({
  useCreateUser: () => ({ mutateAsync: createUser }),
}));
vi.mock("~/api/queries/useUserSettings", () => ({
  useUserSettings: () => ({ data: { language: SUPPORTED_LANGUAGES.EN } }),
}));
vi.mock("~/api/queries/admin/useRoles", () => ({
  useRoles: () => ({ data: [{ slug: SYSTEM_ROLE_SLUGS.STUDENT, name: "Student" }] }),
}));
vi.mock("~/api/queries/admin/useGroups", () => ({
  useGroupsQuery: () => ({ data: [] }),
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => children,
}));

it("returns to the users list after successfully creating a user", async () => {
  // jsdom does not implement element scrolling used by the real role selector.
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  const user = userEvent.setup();
  renderWith().render(
    <MemoryRouter initialEntries={["/admin/users/new"]}>
      <Routes>
        <Route path="/admin/users/new" element={<CreateNewUserPage />} />
        <Route path="/admin/users" element={<h1>Users list</h1>} />
        <Route path="/admin/users/:id" element={<h1>User details</h1>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByTestId(CREATE_USER_PAGE_HANDLES.FIRST_NAME_INPUT), "Created");
  await user.type(screen.getByTestId(CREATE_USER_PAGE_HANDLES.LAST_NAME_INPUT), "User");
  await user.type(screen.getByTestId(CREATE_USER_PAGE_HANDLES.EMAIL_INPUT), "created@example.com");
  await user.click(
    screen.getByTestId(CREATE_USER_PAGE_HANDLES.ROLE_SELECT).querySelector("input")!,
  );
  await user.click(
    await screen.findByTestId(CREATE_USER_PAGE_HANDLES.roleOption(SYSTEM_ROLE_SLUGS.STUDENT)),
  );
  await user.click(screen.getByTestId(CREATE_USER_PAGE_HANDLES.SUBMIT_BUTTON));

  await waitFor(() =>
    expect(createUser).toHaveBeenCalledWith({
      data: {
        firstName: "Created",
        lastName: "User",
        email: "created@example.com",
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        language: SUPPORTED_LANGUAGES.EN,
        managedGroupIds: [],
      },
    }),
  );
  expect(await screen.findByRole("heading", { name: "Users list" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "User details" })).not.toBeInTheDocument();
});
