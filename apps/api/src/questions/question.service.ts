import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";

import { QuestionRepository } from "./question.repository";
import { QUESTION_TYPE } from "./schema/question.types";

import type { QuizEvaluation, QuizQuestion } from "./schema/question.schema";
import type { SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type {
  AnswerQuestionBody,
  FullAnswer,
  OnlyAnswerIdAsnwer,
  OnlyValueAnswer,
  StudentQuestionAnswer,
} from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";

@Injectable()
export class QuestionService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly questionRepository: QuestionRepository,
  ) {}

  async evaluationsQuestions(
    correctAnswersForQuizQuestions: QuizQuestion[],
    studentQuizAnswers: AnswerQuestionBody,
    userId: UUIDType,
    trx: PostgresJsDatabase<typeof schema>,
  ): Promise<QuizEvaluation> {
    const quizEvaluationStats = correctAnswersForQuizQuestions.reduce<QuizEvaluation>(
      (quizStats, question) => {
        const questionAnswerList = studentQuizAnswers.questionsAnswers.find(
          (questionAnswers) => questionAnswers.questionId === question.id,
        );

        if (!questionAnswerList) {
          throw new ConflictException(question.id, "Answer not found for question");
        }

        const passQuestion = this.evaluateQuestion(question, questionAnswerList);
        const answers = this.formatAnswer(question, questionAnswerList);
        const formattedAnswer = this.questionAnswerToString(answers);

        const isScaleQuestion = question.type === QUESTION_TYPE.SCALE_1_5;

        const validAnswer = isScaleQuestion
          ? null
          : {
              questionId: question.id,
              studentId: userId,
              answer: formattedAnswer,
              isCorrect: passQuestion,
            };

        return {
          ...quizStats,
          answers: validAnswer ? [...quizStats.answers, validAnswer] : quizStats.answers,
          correctAnswerCount:
            passQuestion && !isScaleQuestion
              ? quizStats.correctAnswerCount + 1
              : quizStats.correctAnswerCount,
          wrongAnswerCount:
            !passQuestion && !isScaleQuestion
              ? quizStats.wrongAnswerCount + 1
              : quizStats.wrongAnswerCount,
        };
      },
      {
        answers: [],
        correctAnswerCount: 0,
        wrongAnswerCount: 0,
      },
    );

    await this.questionRepository.insertQuizAnswers(quizEvaluationStats.answers, trx);

    return quizEvaluationStats;
  }

  private evaluateQuestion(question: QuizQuestion, studentAnswer: StudentQuestionAnswer): boolean {
    return match(question.type)
      .returnType<boolean>()
      .with(QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT, QUESTION_TYPE.FILL_IN_THE_BLANKS_DND, () => {
        return question.correctAnswers.every((correctAnswer) => {
          const answer = studentAnswer.answers[correctAnswer.displayOrder - 1];
          return this.isAnswerWithValue(answer) && this.getValue(answer) === correctAnswer.value;
        });
      })
      .with(QUESTION_TYPE.BRIEF_RESPONSE, QUESTION_TYPE.DETAILED_RESPONSE, () => {
        if (studentAnswer.answers.length !== 1) {
          throw new ConflictException(
            question.id,
            "Brief/Detailed response must have exactly one answer",
          );
        }

        // TODO: implement this
        return true;
      })
      .with(QUESTION_TYPE.SINGLE_CHOICE, QUESTION_TYPE.PHOTO_QUESTION_SINGLE_CHOICE, () => {
        if (studentAnswer.answers.length !== 1) {
          throw new ConflictException(question.id, "Single choice must have exactly one answer");
        }

        const answer = studentAnswer.answers[0];
        return (
          this.isAnswerWithId(answer) &&
          this.getAnswerId(answer) === question.correctAnswers[0].answerId
        );
      })
      .with(QUESTION_TYPE.MULTIPLE_CHOICE, QUESTION_TYPE.PHOTO_QUESTION_MULTIPLE_CHOICE, () => {
        if (question.correctAnswers.length !== studentAnswer.answers.length) {
          return false;
        }

        return question.correctAnswers.every((correctAnswer) =>
          studentAnswer.answers.some(
            (answer) =>
              this.isAnswerWithId(answer) && this.getAnswerId(answer) === correctAnswer.answerId,
          ),
        );
      })
      .with(QUESTION_TYPE.TRUE_OR_FALSE, () => {
        if (question.allAnswers.length !== studentAnswer.answers.length) {
          throw new ConflictException(question.id, "Invalid number of answers for true/false");
        }

        return question.allAnswers.every((answer) => {
          const studentAnswerForOption = studentAnswer.answers.find(
            (a) => this.isAnswerWithId(a) && this.getAnswerId(a) === answer.answerId,
          );

          if (!studentAnswerForOption || !this.isAnswerWithValue(studentAnswerForOption)) {
            return false;
          }

          return this.getValue(studentAnswerForOption) === answer.isCorrect.toString();
        });
      })
      .with(QUESTION_TYPE.MATCH_WORDS, () => {
        return question.correctAnswers.every((correctAnswer) => {
          const answer = studentAnswer.answers.find(
            (a) => this.isAnswerWithId(a) && this.getAnswerId(a) === correctAnswer.answerId,
          );

          if (!answer || !this.isAnswerWithValue(answer)) {
            return false;
          }

          return this.getValue(answer) === correctAnswer.value;
        });
      })
      .with(QUESTION_TYPE.SCALE_1_5, () => {
        return true;
      })
      .otherwise(() => {
        throw new Error(`Unsupported question type: ${question.type}`);
      });
  }

  private formatAnswer(
    question: QuizQuestion,
    studentAnswer: StudentQuestionAnswer,
  ): string[] | number[] {
    if (
      question.type === QUESTION_TYPE.BRIEF_RESPONSE ||
      question.type === QUESTION_TYPE.DETAILED_RESPONSE
    ) {
      const answer = studentAnswer.answers[0];
      return ["value" in answer ? answer.value : ""];
    }

    if (question.type === QUESTION_TYPE.SCALE_1_5) {
      const answer = studentAnswer.answers[0];

      console.log("answer scale 1.5", answer);

      if ("value" in answer) {
        const scaleValue = parseInt(answer.value, 10);
        if (isNaN(scaleValue)) {
          throw new Error(`Invalid scale value: ${answer.value}`);
        }
        return [scaleValue];
      }

      throw new Error("Scale question must have a value");
    }

    return studentAnswer.answers.map((answer) => {
      if ("value" in answer) {
        return answer.value;
      }

      const answerOption = question.allAnswers.find(
        (option) => "answerId" in answer && option.answerId === answer.answerId,
      );

      if (!answerOption) {
        throw new Error(
          `Answer option not found for answerId: ${
            "answerId" in answer ? answer.answerId : "unknown"
          }`,
        );
      }

      return answerOption.value;
    });
  }

  private questionAnswerToString(answers: string[] | number[]): SQL<unknown> {
    console.log("answers question to string", answers);
    const convertedAnswers: (SQL<unknown> | string)[] = answers.flatMap((answer, index) => [
      sql`(${index + 1}::int)`,
      sql`${answer}::text`,
    ]);

    return sql`json_build_object(${sql.join(convertedAnswers, sql`, `)})`;
  }

  private isAnswerWithId(answer: unknown): answer is OnlyAnswerIdAsnwer | FullAnswer {
    return Boolean(answer && typeof answer === "object" && "answerId" in answer);
  }

  private isAnswerWithValue(answer: unknown): answer is OnlyValueAnswer | FullAnswer {
    return Boolean(answer && typeof answer === "object" && "value" in answer);
  }

  private getAnswerId(answer: OnlyAnswerIdAsnwer | FullAnswer): string {
    return answer.answerId;
  }

  private getValue(answer: OnlyValueAnswer | FullAnswer): string {
    return answer.value;
  }
}
