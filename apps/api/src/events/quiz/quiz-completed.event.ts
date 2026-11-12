import type { UUIDType } from "src/common";

export type QuizCompletedData = {
  userId: UUIDType;
  courseId: UUIDType;
  lessonId: UUIDType;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
  isSupportMode: boolean;
};

export class QuizCompletedEvent {
  constructor(public readonly quizCompletionData: QuizCompletedData) {}
}
