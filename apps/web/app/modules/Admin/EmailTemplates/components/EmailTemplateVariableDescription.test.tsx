import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import cs from "~/locales/cs/translation.json";
import de from "~/locales/de/translation.json";
import en from "~/locales/en/translation.json";
import es from "~/locales/es/translation.json";
import fr from "~/locales/fr/translation.json";
import lt from "~/locales/lt/translation.json";
import pl from "~/locales/pl/translation.json";
import { renderWith } from "~/utils/testUtils";

import { EmailTemplateBlockSidebar } from "./EmailTemplateBlockSidebar";
import { EmailTemplateVariableDescription } from "./EmailTemplateVariableDescription";
import { EmailVariablePicker } from "./EmailVariablePicker";

const variables = [
  {
    key: "assignment_deadline_message",
    label: "Assignment deadline message",
    type: "text" as const,
    sampleValue: "Sample deadline",
  },
];
const description = en.emailTemplates.variableDescriptions.assignment_deadline_message;

describe("Email template variable descriptions", () => {
  it("shows conditional behavior alongside sidebar variables and preserves insertion", () => {
    const onInsertVariable = vi.fn();
    renderWith().render(
      <EmailTemplateBlockSidebar
        variables={variables}
        disabled={false}
        hidden={false}
        onInsertBlock={vi.fn()}
        onInsertVariable={onInsertVariable}
      />,
    );
    expect(screen.getByText(description)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "{{ assignment_deadline_message }}" }));
    expect(onInsertVariable).toHaveBeenCalledWith("{{ assignment_deadline_message }}");
  });

  it("explains variables in the dropdown without changing the inserted token", async () => {
    const onInsert = vi.fn();
    renderWith().render(<EmailVariablePicker variables={variables} onInsert={onInsert} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(await screen.findByText(description)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("option", { name: /assignment_deadline_message/ }), {
      key: "Enter",
    });
    expect(onInsert).toHaveBeenCalledWith("{{ assignment_deadline_message }}");
  });

  it("does not show missing translation keys for ordinary variables", () => {
    const { container } = renderWith().render(
      <EmailTemplateVariableDescription variableKey="course_name" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each(Object.entries({ cs, de, en, es, fr, lt, pl }))(
    "provides all descriptions in %s",
    (_locale, translation) => {
      for (const key of Object.keys(en.emailTemplates.variableDescriptions)) {
        expect(
          (translation.emailTemplates.variableDescriptions as Record<string, string>)[key],
          key,
        ).toBeTruthy();
      }
    },
  );
});
