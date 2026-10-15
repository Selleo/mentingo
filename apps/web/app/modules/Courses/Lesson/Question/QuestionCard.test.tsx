import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuestionCard } from "./QuestionCard";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("QuestionCard title", () => {
  it.each([
    '<img src="invalid" onerror="alert(document.cookie)">',
    '<svg onload="alert(1)"></svg>',
    '<a href="javascript:alert(1)">Open</a>',
  ])("sanitizes stored or generated title markup: %s", (title) => {
    const { container } = render(
      <QuestionCard questionNumber={1} questionType="singleChoice" title={title}>
        <button type="button">Answer</button>
      </QuestionCard>,
    );

    expect(container.querySelector("img, svg, a, script")).toBeNull();
    expect(screen.getByRole("button", { name: "Answer" })).toBeVisible();
  });

  it("preserves basic formatting and mathematical text", () => {
    const { container } = render(
      <QuestionCard
        questionNumber={1}
        questionType="singleChoice"
        title={
          '<strong onclick="alert(1)" style="color:red">Is 2 &lt; 3 &amp; 4 &gt; 1?</strong><br><em>Explain.</em>'
        }
      >
        Answer
      </QuestionCard>,
    );

    expect(screen.getByText("Is 2 < 3 & 4 > 1?").tagName).toBe("STRONG");
    expect(screen.getByText("Explain.").tagName).toBe("EM");
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.querySelector("[onclick], [style]")).toBeNull();
  });
});
