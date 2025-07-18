type QuizLessonProps = {
  thresholdScore: number;
  attemptsLimit: number;
  quizCooldown: number;
};

export const defaultQuizLessonValues: QuizLessonProps = {
  thresholdScore: 0,
  attemptsLimit: 1,
  quizCooldown: 24,
};
