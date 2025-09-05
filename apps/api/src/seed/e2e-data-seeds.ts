import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QUESTION_TYPE } from "src/questions/schema/question.types";

import type { NiceCourseData } from "../utils/types/test-types";

export const e2eCourses: NiceCourseData[] = [
  {
    title: "E2E Test: Automated Course for Full-Stack Development",
    description:
      "This course is specifically generated for end-to-end testing purposes. It includes mock content to simulate a comprehensive learning experience in full-stack web development. Topics cover front-end frameworks like React and Next.js, back-end technologies such as Node.js and Nest.js, and database integration. This course ensures thorough testing of user interactions, workflows, and application features.",
    status: "published",
    priceInCents: 0,
    category: "E2E Testing",
    thumbnailS3Key: "https://placehold.co/600x400",
    chapters: [
      {
        title: "Introduction to E2E Testing",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.TEXT,
            title: "An introduction to end-to-end testing, its benefits, and tools.",
            description: `
              <h2>Understanding End-to-End (E2E) Testing</h2>
              <p>End-to-end (E2E) testing is a comprehensive testing method designed to verify the workflow of an application from start to finish. It ensures that all components of the system work together as expected.</p>

              <h3>Benefits of E2E Testing</h3>
              <ul>
                <li>Improved user experience by simulating real-world scenarios.</li>
                <li>Detection of integration issues between components.</li>
                <li>Verification of critical application workflows.</li>
              </ul>

              <h3>Common Tools for E2E Testing</h3>
              <ol>
                <li><strong>Cypress:</strong> A popular tool for fast and reliable testing.</li>
                <li><strong>Playwright:</strong> Supports cross-browser testing and advanced features.</li>
                <li><strong>Selenium:</strong> A versatile tool for automating web browsers.</li>
              </ol>

              <h3>Why Use E2E Testing?</h3>
              <p>By using E2E testing, developers can identify issues that might not surface in unit or integration tests, providing a higher level of confidence in the application’s overall quality.</p>
            `,
          },
          {
            type: LESSON_TYPES.PRESENTATION,
            title: "Best Practices for E2E Testing",
            description: "Slides detailing E2E testing strategies and common pitfalls.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "E2E Testing Knowledge Check",
            description: "A quiz to assess your understanding of E2E testing concepts.",
            questions: [
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title: "What is the primary purpose of E2E testing?",
                description: "Write a brief response explaining the purpose of E2E testing.",
              },
              {
                type: QUESTION_TYPE.DETAILED_RESPONSE,
                title: "Describe the differences between unit and E2E testing.",
                description: "Provide a detailed response contrasting unit tests and E2E tests.",
              },
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which tool is used for E2E testing?",
                description: "Select the best tool for E2E testing.",
                options: [
                  { optionText: "Cypress", isCorrect: true },
                  { optionText: "Jest", isCorrect: false },
                ],
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Select All Features of E2E Testing",
                description: "Choose all features that apply to E2E testing.",
                options: [
                  { optionText: "Simulates real user interactions", isCorrect: true },
                  { optionText: "Focuses only on unit tests", isCorrect: false },
                  { optionText: "Tests entire application workflow", isCorrect: true },
                  { optionText: "Validates data integrity", isCorrect: false },
                ],
              },
              {
                type: QUESTION_TYPE.TRUE_OR_FALSE,
                title: "True or False: E2E tests replace all other tests.",
                description: "Determine whether the statement is true or false.",
                options: [
                  { optionText: "True", isCorrect: false },
                  { optionText: "False", isCorrect: true },
                ],
              },
              {
                type: QUESTION_TYPE.PHOTO_QUESTION_SINGLE_CHOICE,
                title: "Identify the Correct Workflow",
                description: "Choose the option that represents an E2E testing workflow.",
                options: [
                  { optionText: "Workflow A", isCorrect: false },
                  { optionText: "Workflow B", isCorrect: true },
                  { optionText: "Workflow C", isCorrect: false },
                  { optionText: "Workflow B", isCorrect: false },
                ],
              },
              {
                type: QUESTION_TYPE.PHOTO_QUESTION_MULTIPLE_CHOICE,
                title: "Select All Correct Tools",
                description: "Choose the options that represent E2E testing tools.",
                options: [
                  { optionText: "Cypress", isCorrect: true },
                  { optionText: "Jest", isCorrect: false },
                  { optionText: "Playwright", isCorrect: true },
                  { optionText: "Vitest", isCorrect: false },
                ],
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT,
                title: "Complete the Definition",
                description: "E2E testing is used to test the [word] of an application.",
                solutionExplanation:
                  "E2E testing is used to test the <strong>workflow</strong> of an application.",
                options: [
                  {
                    optionText: "workflow",
                    isCorrect: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
