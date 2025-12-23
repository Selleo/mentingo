import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuizContextProvider, useQuizContext } from "./QuizContextProvider";

const TestComponent = () => {
  const { isQuizFeedbackRedacted, isQuizSubmitted } = useQuizContext();
  return (
    <div>
      <span data-testid="isQuizFeedbackRedacted">{String(isQuizFeedbackRedacted)}</span>
      <span data-testid="isQuizSubmitted">{String(isQuizSubmitted)}</span>
    </div>
  );
};

describe("QuizContextProvider", () => {
  it("provides default values when no props are passed", () => {
    render(
      <QuizContextProvider>
        <TestComponent />
      </QuizContextProvider>,
    );

    expect(screen.getByTestId("isQuizFeedbackRedacted")).toHaveTextContent("false");
    expect(screen.getByTestId("isQuizSubmitted")).toHaveTextContent("false");
  });

  it("provides custom isQuizFeedbackRedacted value", () => {
    render(
      <QuizContextProvider isQuizFeedbackRedacted={true}>
        <TestComponent />
      </QuizContextProvider>,
    );

    expect(screen.getByTestId("isQuizFeedbackRedacted")).toHaveTextContent("true");
    expect(screen.getByTestId("isQuizSubmitted")).toHaveTextContent("false");
  });

  it("provides custom isQuizSubmitted value", () => {
    render(
      <QuizContextProvider isQuizSubmitted={true}>
        <TestComponent />
      </QuizContextProvider>,
    );

    expect(screen.getByTestId("isQuizFeedbackRedacted")).toHaveTextContent("false");
    expect(screen.getByTestId("isQuizSubmitted")).toHaveTextContent("true");
  });

  it("provides both custom values", () => {
    render(
      <QuizContextProvider isQuizFeedbackRedacted={true} isQuizSubmitted={true}>
        <TestComponent />
      </QuizContextProvider>,
    );

    expect(screen.getByTestId("isQuizFeedbackRedacted")).toHaveTextContent("true");
    expect(screen.getByTestId("isQuizSubmitted")).toHaveTextContent("true");
  });

  it("returns default values when used outside provider", () => {
    render(<TestComponent />);

    expect(screen.getByTestId("isQuizFeedbackRedacted")).toHaveTextContent("false");
    expect(screen.getByTestId("isQuizSubmitted")).toHaveTextContent("false");
  });
});
