import { ForbiddenException, Injectable, NotImplementedException } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class TestConfigService {
  constructor(private readonly studentLessonProgressService: StudentLessonProgressService) {}

  public async setup() {
    throw new NotImplementedException();
  }

  public async teardown() {
    throw new NotImplementedException();
  }

  public async prepareAiMentorStatisticsProgress({
    actor,
    language = SUPPORTED_LANGUAGES.EN,
    lessonId,
    studentId,
  }: {
    actor: CurrentUserType;
    language?: SupportedLanguages;
    lessonId: UUIDType;
    studentId: UUIDType;
  }) {
    this.ensureTestConfigWritesAllowed();

    await this.studentLessonProgressService.markLessonAsCompleted({
      actor,
      aiMentorLessonData: {
        maxScore: 10,
        minScore: 5,
        passed: true,
        percentage: 80,
        score: 8,
        summary: "Prepared AI mentor statistics progress for E2E.",
      },
      id: lessonId,
      language,
      studentId,
      userPermissions: [],
    });
  }

  private ensureTestConfigWritesAllowed() {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "staging") return;

    throw new ForbiddenException("Test config writes are disabled outside test and staging");
  }
}
