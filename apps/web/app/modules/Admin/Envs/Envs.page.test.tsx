import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import EnvsPage from "~/modules/Admin/Envs/Envs.page";
import { mockRemixReact } from "~/utils/mocks/remix-run-mock";
import { renderWith } from "~/utils/testUtils";

mockRemixReact();

vi.mock("~/api/queries/admin/useSecret", () => ({
  useSecret: () => ({
    data: { name: "", value: "" },
  }),
}));

const RemixStub = createRemixStub([
  {
    path: "/",
    Component: EnvsPage,
  },
]);

describe("Login page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders without crashing", () => {
    renderWith({ withQuery: true }).render(<RemixStub />);
    expect(screen.getByRole("heading", { name: "Environment Variables" }));
  });
});
