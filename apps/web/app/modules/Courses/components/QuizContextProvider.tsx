import { createContext, useContext, type PropsWithChildren } from "react";

const defaultValue = {
  isQuizFeedbackRedacted: false,
  isQuizSubmitted: false,
};

type QuizContextValue = typeof defaultValue;

const quizContext = createContext(defaultValue);

export const useQuizContext = () => useContext(quizContext) ?? defaultValue;

export const QuizContextProvider = ({
  children,
  ...values
}: PropsWithChildren<Partial<QuizContextValue>>) => {
  return (
    <quizContext.Provider value={{ ...defaultValue, ...values }}>{children}</quizContext.Provider>
  );
};
