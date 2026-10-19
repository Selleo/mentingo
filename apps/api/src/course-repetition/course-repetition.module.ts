import { Global, Module } from "@nestjs/common";

import { CourseLearningWriteInterceptor } from "./course-learning-write.interceptor";
import { CourseRepetitionService } from "./course-repetition.service";

@Global()
@Module({
  providers: [CourseRepetitionService, CourseLearningWriteInterceptor],
  exports: [CourseRepetitionService, CourseLearningWriteInterceptor],
})
export class CourseRepetitionModule {}
