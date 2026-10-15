import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi, it, expect } from "vitest";

import { renderWith } from "~/utils/testUtils";

import LoginMethods from "./LoginMethods";

const state = vi.hoisted(() => ({
  methods: { google: false, microsoft: false, slack: false, magicLink: true, password: true },
  missing: {
    google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    microsoft: ["MICROSOFT_CLIENT_SECRET"],
    slack: [],
  },
}));
const post = vi.hoisted(() => vi.fn());
vi.mock("~/api/api-client", () => ({
  ApiClient: { instance: { get: vi.fn(async () => ({ data: { data: state } })), post } },
}));
vi.mock("~/api/queries/admin/useSecret", () => ({ useSecret: () => ({}) }));

it("opens only the selected provider's missing fields and closing cancels enabling", async () => {
  renderWith({ withQuery: true }).render(<LoginMethods />);
  const microsoft = await screen.findByRole("switch", { name: "Microsoft" });
  expect(screen.getAllByRole("switch")).toHaveLength(5);
  await userEvent.click(microsoft);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(document.getElementById("MICROSOFT_CLIENT_SECRET")).toBeInTheDocument();
  expect(document.getElementById("MICROSOFT_CLIENT_ID")).not.toBeInTheDocument();
  expect(document.getElementById("GOOGLE_CLIENT_SECRET")).not.toBeInTheDocument();
  expect(document.getElementById("MICROSOFT_CALENDAR_CLIENT_SECRET")).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(microsoft).toHaveAttribute("aria-checked", "false");
});

it("saves valid missing credentials with the enable operation", async () => {
  post.mockResolvedValue({ data: { data: state } });
  renderWith({ withQuery: true }).render(<LoginMethods />);
  await userEvent.click(await screen.findByRole("switch", { name: "Microsoft" }));
  await userEvent.type(document.getElementById("MICROSOFT_CLIENT_SECRET")!, "new-secret");
  await userEvent.click(screen.getByRole("button", { name: /save/i }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("/api/env/login-methods", {
      method: "microsoft",
      enabled: true,
      configuration: [{ name: "MICROSOFT_CLIENT_SECRET", value: "new-secret" }],
    }),
  );
});
