import type { UUIDType } from "src/common";

type QuizCompletedData = {
  userId: UUIDType;
  courseId: UUIDType;
  lessonId: UUIDType;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
};

export class QuizCompletedEvent {
  public readonly userId: UUIDType;
  public readonly courseId: UUIDType;
  public readonly lessonId: UUIDType;
  public readonly correctAnswers: number;
  public readonly wrongAnswers: number;
  public readonly score: number;

  constructor(data: QuizCompletedData) {
    this.userId = data.userId;
    this.courseId = data.courseId;
    this.lessonId = data.lessonId;
    this.correctAnswers = data.correctAnswers;
    this.wrongAnswers = data.wrongAnswers;
    this.score = data.score;
  }
}
