import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_RECIPIENT_AUDIENCES,
  AUTOMATION_RECIPIENT_TYPES,
} from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import translation from "~/locales/pl/translation.json";

import { EmailRecipientsSettings } from "./EmailRecipientsSettings";

import type { AutomationEventDefinition } from "@repo/shared";

vi.mock("./AutomationRecipientPicker", () => ({ AutomationRecipientPicker: () => null }));

const courseCompletionEvent: AutomationEventDefinition = {
  kind: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE,
  label: "Course completion",
  description: "",
  recipientPolicy: "",
  fields: [],
  providedVariables: [],
};

describe("course completion email audience", () => {
  it("selects administrators on the email action, not on the condition", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "pl", resources: { pl: { translation } } });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <EmailRecipientsSettings
          event={courseCompletionEvent}
          disabled={false}
          hasAccountActionLinks={false}
          onChange={onChange}
        />
      </I18nextProvider>,
    );
    await user.click(screen.getByRole("combobox", { name: "Odbiorcy ukończenia kursu" }));
    await user.click(
      screen.getByRole("option", { name: "Administratorzy (zgodnie z preferencjami powiadomień)" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      type: AUTOMATION_RECIPIENT_TYPES.EVENT,
      audience: AUTOMATION_RECIPIENT_AUDIENCES.ADMINISTRATORS,
    });
  });
});
