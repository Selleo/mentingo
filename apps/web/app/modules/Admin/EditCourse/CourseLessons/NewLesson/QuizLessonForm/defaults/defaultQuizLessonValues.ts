type QuizLessonProps = {
  thresholdScore: number;
  attemptsLimit: number;
  quizCooldownInHours: number;
};

export const defaultQuizLessonValues: QuizLessonProps = {
  thresholdScore: 0,
  attemptsLimit: 1,
  quizCooldownInHours: 24,
};
