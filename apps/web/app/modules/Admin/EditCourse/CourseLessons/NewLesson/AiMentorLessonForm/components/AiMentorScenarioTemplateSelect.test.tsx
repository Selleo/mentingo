import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AI_MENTOR_SCENARIO_TEMPLATE } from "../utils/AiMentorScenarioTemplate.helpers";

import { AiMentorScenarioTemplateSelect } from "./AiMentorScenarioTemplateSelect";

describe("AiMentorScenarioTemplateSelect", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("offers four one-time template actions", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWith().render(<AiMentorScenarioTemplateSelect onSelect={onSelect} />);

    expect(screen.getAllByRole("button")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Scenario Simulation" }));
    expect(onSelect).toHaveBeenCalledWith(AI_MENTOR_SCENARIO_TEMPLATE.SCENARIO_SIMULATION);
    expect(screen.getByRole("button", { name: "Scenario Simulation" })).not.toHaveAttribute(
      "aria-pressed",
    );
  });
});
