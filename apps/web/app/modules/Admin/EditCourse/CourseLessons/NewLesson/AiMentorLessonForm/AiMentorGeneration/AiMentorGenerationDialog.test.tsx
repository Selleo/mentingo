import { AI_MENTOR_TYPE } from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AI_MENTOR_GENERATION_MODE } from "./aiMentorGeneration.types";
import { AiMentorGenerationDialog } from "./AiMentorGenerationDialog";

vi.mock("~/components/RichText/Editor", () => ({
  BaseEditor: ({
    content,
    onChange,
    ariaLabel,
  }: {
    content: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe("AiMentorGenerationDialog", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("uses the creator-selected type as trusted request context", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    const onSelectedTypeChange = vi.fn();
    renderWith().render(
      <AiMentorGenerationDialog
        open
        onOpenChange={vi.fn()}
        mode={AI_MENTOR_GENERATION_MODE.CREATE}
        selectedType={AI_MENTOR_TYPE.TEACHER}
        onSelectedTypeChange={onSelectedTypeChange}
        onGenerate={onGenerate}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Roleplay/ }));
    expect(onSelectedTypeChange).toHaveBeenCalledWith(AI_MENTOR_TYPE.ROLEPLAY);

    await user.type(screen.getByRole("textbox", { name: "What should AI create?" }), "Teach GDPR.");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));

    expect(onGenerate).toHaveBeenCalledWith({
      mode: AI_MENTOR_GENERATION_MODE.CREATE,
      brief: "Teach GDPR.",
      configurationType: AI_MENTOR_TYPE.TEACHER,
    });
  });
});
