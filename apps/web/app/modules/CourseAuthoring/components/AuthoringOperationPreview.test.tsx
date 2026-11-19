import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AuthoringOperationPreview } from "./AuthoringOperationPreview";

import type { AuthoringOperation } from "../courseAuthoring.types";

const makeOperation = (overrides: Partial<AuthoringOperation> = {}): AuthoringOperation => ({
  operationId: "operation-1",
  targetId: "lesson-1",
  type: "create_lesson",
  dependencies: [],
  payload: { lessonType: "ai_mentor", configurationType: "roleplay" },
  ...overrides,
});

afterEach(async () => {
  await act(async () => {
    await i18next.changeLanguage("en");
  });
});

describe("AuthoringOperationPreview", () => {
  it("shows the AI mentor mode in the UI language", async () => {
    await act(async () => {
      await i18next.changeLanguage("pl");
    });

    renderWith().render(<AuthoringOperationPreview operation={makeOperation()} />);

    expect(screen.getByText("Odgrywanie ról")).toBeInTheDocument();
    expect(screen.queryByText("roleplay")).not.toBeInTheDocument();
  });
});
