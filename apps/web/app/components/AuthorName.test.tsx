import { act, screen } from "@testing-library/react";
import { afterEach, it, expect } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AuthorName } from "./AuthorName";

afterEach(async () => {
  await act(async () => {
    await i18next.changeLanguage("en");
  });
});

it("shows a single localized label for a deleted author", async () => {
  const { rerender } = renderWith().render(<AuthorName name="deleted user deleted user" deleted />);

  expect(screen.getByText("Deleted user")).toBeInTheDocument();

  await act(async () => {
    await i18next.changeLanguage("pl");
  });
  expect(screen.getByText("Usunięty użytkownik")).toBeInTheDocument();

  rerender(<AuthorName name="Ada Lovelace" deleted={false} />);
  expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
});
