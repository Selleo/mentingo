type QuizLessonProps = {
  thresholdScore: string;
  attemptsLimit: string;
  quizCooldown: string;
};

export const defaultQuizLessonValues: QuizLessonProps = {
  thresholdScore: "0",
  attemptsLimit: "1",
  quizCooldown: "24",
};
