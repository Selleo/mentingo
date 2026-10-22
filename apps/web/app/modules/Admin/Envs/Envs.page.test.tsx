import { createRemixStub } from "@remix-run/testing";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, it, vi } from "vitest";

import { queryClient } from "~/api/queryClient";
import EnvsPage from "~/modules/Admin/Envs/Envs.page";
import { mockRemixReact } from "~/utils/mocks/remix-run-mock";
import { renderWith } from "~/utils/testUtils";

mockRemixReact();

const api = vi.hoisted(() => ({ saveSecrets: vi.fn() }));

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { envControllerBulkUpsertEnv: api.saveSecrets } },
}));

vi.mock("~/api/queries/admin/useSecret", () => ({
  useSecret: () => ({
    data: { data: { name: "", value: "" } },
  }),
}));

const RemixStub = createRemixStub([
  {
    path: "/",
    Component: EnvsPage,
  },
]);

describe("Environment page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.saveSecrets.mockResolvedValue({ data: {} });
  });

  it("renders the Microsoft Calendar environment fields", () => {
    renderWith({ withQuery: true }).render(<RemixStub />);
    expect(screen.getByRole("heading", { name: "Environment Variables" }));
    expect(screen.getByLabelText("Microsoft Calendar Client ID"));
    expect(screen.getByLabelText("Microsoft Calendar Client Secret"));
    expect(screen.getByLabelText("Bunny Stream Read-Only API Key"));
    expect(
      screen.getByText("Read-only Bunny Stream library key used to verify Bunny Stream webhooks."),
    );
  });

  it("saves the competency connection only after explicitly revealing its fields", async () => {
    const user = userEvent.setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    renderWith({ withQuery: true }).render(<RemixStub />);
    expect(screen.getByRole("heading", { name: "Competencies" })).toBeVisible();

    const serviceUrl = screen.getByLabelText("Competencies service URL");
    const apiKey = screen.getByLabelText("Competencies API key");
    expect(serviceUrl).toBeDisabled();
    expect(apiKey).toBeDisabled();
    expect(api.saveSecrets).not.toHaveBeenCalled();

    for (const [field, value] of [
      [serviceUrl, "https://plugins.example.test"],
      [apiKey, "test-only-competencies-key"],
    ] as const) {
      await user.click(within(field.parentElement!).getByRole("button"));
      await user.type(field, value);
    }
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.saveSecrets).toHaveBeenCalledWith([
        { name: "COMPETENCIES_BASE_URL", value: "https://plugins.example.test" },
        { name: "COMPETENCIES_API_KEY", value: "test-only-competencies-key" },
      ]),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["competencies"] }));
  });
});
