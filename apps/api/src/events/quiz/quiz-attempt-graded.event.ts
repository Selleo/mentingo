import type { UUIDType } from "src/common";

type QuizAttemptGradedData = {
  userId: UUIDType;
  courseId: UUIDType;
  lessonId: UUIDType;
  attemptId: UUIDType;
  reviewerId: UUIDType;
  score: number;
  passed: boolean;
  isRegrade: boolean;
};

export class QuizAttemptGradedEvent {
  public readonly userId: UUIDType;
  public readonly courseId: UUIDType;
  public readonly lessonId: UUIDType;
  public readonly attemptId: UUIDType;
  public readonly reviewerId: UUIDType;
  public readonly score: number;
  public readonly passed: boolean;
  public readonly isRegrade: boolean;

  constructor(data: QuizAttemptGradedData) {
    this.userId = data.userId;
    this.courseId = data.courseId;
    this.lessonId = data.lessonId;
    this.attemptId = data.attemptId;
    this.reviewerId = data.reviewerId;
    this.score = data.score;
    this.passed = data.passed;
    this.isRegrade = data.isRegrade;
  }
}
