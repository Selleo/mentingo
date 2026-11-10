import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import translation from "~/locales/pl/translation.json";

import { CreateEmailTemplateDialog } from "./CreateEmailTemplateDialog";

const mocks = vi.hoisted(() => ({
  createTemplate: vi.fn().mockResolvedValue({ id: "created" }),
  navigate: vi.fn(),
}));

vi.mock("@remix-run/react", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => "pl",
}));
vi.mock("~/api/queries/useEmailTemplateEvents", () => ({
  useEmailTemplateEvents: () => ({
    data: [
      { kind: "user_finished_course", label: "Learner completion" },
      { kind: "admin_finished_course", label: "Admin completion" },
    ],
    isPending: false,
    isError: false,
  }),
}));
vi.mock("~/api/mutations/emailTemplates/useCreateEmailTemplate", () => ({
  useCreateEmailTemplate: () => ({ mutateAsync: mocks.createTemplate, isPending: false }),
}));

describe("CreateEmailTemplateDialog completion events", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["uczestnika", "user_finished_course"],
    ["administratora", "admin_finished_course"],
  ])("selects the event for %s without changing its identity", async (recipient, kind) => {
    const i18n = createInstance();
    await i18n.init({ lng: "pl", resources: { pl: { translation } } });
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <CreateEmailTemplateDialog onClose={vi.fn()} />
      </I18nextProvider>,
    );
    await user.type(screen.getByRole("textbox", { name: "Nazwa szablonu" }), "Test");
    await user.click(screen.getByRole("combobox", { name: "Zdarzenie" }));
    const search = screen.getAllByRole("combobox").find((element) => element.tagName === "INPUT")!;
    await user.type(search, "kurs");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.click(
      screen.getByRole("option", {
        name: `Uczestnik ukończył kurs — e-mail do ${recipient}`,
      }),
    );
    await user.click(screen.getByRole("button", { name: translation.emailTemplates.ui.create }));
    await waitFor(() =>
      expect(mocks.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ triggerEventKind: kind }),
      ),
    );
  });
});
