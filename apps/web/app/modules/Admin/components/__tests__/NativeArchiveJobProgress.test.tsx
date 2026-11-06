import { screen } from "@testing-library/react";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { NativeArchiveJobProgress } from "../NativeArchiveJobProgress";

describe("NativeArchiveJobProgress", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it.each([
    {
      case: "the current stage and percentage",
      progress: { stage: "uploading-files" as const, percent: 45 },
      label: "Uploading files",
      percent: "45%",
    },
    {
      case: "a waiting state before the job reports",
      progress: null,
      label: "Waiting to start…",
      percent: "0%",
    },
  ])("shows $case", ({ progress, label, percent }) => {
    renderWith({}).render(<NativeArchiveJobProgress progress={progress} />);

    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(screen.getByText(percent)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: label })).toBeInTheDocument();
  });
});
