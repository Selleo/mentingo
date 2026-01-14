import { faker } from "@faker-js/faker";
import * as dotenv from "dotenv";

import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QUESTION_TYPE } from "src/questions/schema/question.types";

import {
  appendResourceLinkToDescription,
  getRandomPresentationUrl,
  getRandomVideoUrl,
} from "./seed-resource-links";

import type { NiceCourseData } from "src/utils/types/test-types";

dotenv.config({ path: "./.env" });

const withVideoLink = (description?: string) =>
  appendResourceLinkToDescription(description, getRandomVideoUrl());

const withPresentationLink = (description?: string) =>
  appendResourceLinkToDescription(description, getRandomPresentationUrl());

export const niceCourses: NiceCourseData[] = [
  {
    title: "Data Science Foundations: From Data to Decisions",
    description:
      "Build a practical foundation in data science by learning how data is collected, cleaned, analyzed, and communicated. You will explore real-world use cases, practice reading visualizations, and learn how to choose the right approach for common analytical questions.",
    status: "published",
    priceInCents: 0,
    category: "Data Science",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "The Data Science Workflow",
        isFreemium: true,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "What is Data Science?",
            description: withPresentationLink(
              withVideoLink(`
              <p><strong>Duration:</strong> 45-60 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Learning Goals</h2>
              <ul>
                <li><p>Define data science and how it differs from data analytics.</p></li>
                <li><p>Identify the core steps of a data science workflow.</p></li>
                <li><p>Connect data science methods to real-world problems.</p></li>
              </ul>
              <p></p>
              <h2>Core Idea</h2>
              <p><strong>Data Science</strong> combines statistics, computing, and domain knowledge to turn raw data into insights and predictions.</p>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Key Steps</h2>
              <ol>
                <li><p>Collect and understand the data.</p></li>
                <li><p>Clean and prepare the data.</p></li>
                <li><p>Explore patterns and build models.</p></li>
                <li><p>Communicate results and decisions.</p></li>
              </ol>
              <p></p>
              <h2>Slides</h2>
              <p></p>
              <h2>Quick Activity</h2>
              <p>Pick a product you use daily and answer:</p>
              <ul>
                <li><p>What data could it collect?</p></li>
                <li><p>What decision could be improved with that data?</p></li>
              </ul>
            `),
            ),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Framing a Data Question",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Why It Matters</h2>
              <p>Good analysis starts with a clear question. A vague goal like "increase retention" becomes actionable when you define who, what, and when.</p>
              <p></p>
              <h2>From Goal to Question</h2>
              <ol>
                <li><p>State the business goal in one sentence.</p></li>
                <li><p>Define a measurable metric (for example, repeat purchases).</p></li>
                <li><p>Set a time window and target audience.</p></li>
              </ol>
              <p></p>
              <h2>Examples</h2>
              <ul>
                <li><p>Goal: improve onboarding.</p></li>
                <li><p>Question: which steps correlate with users who return after 7 days?</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Write your own question using the template:</p>
              <p><strong>Which</strong> [user group] <strong>does</strong> [action] <strong>within</strong> [time window]?</p>
            `,
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Workflow Check",
            description: "Check your understanding of the core data science workflow.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which step typically comes before modeling?",
                options: [
                  { optionText: "Data preparation", isCorrect: true, language: "en" },
                  { optionText: "Deployment", isCorrect: false, language: "en" },
                  { optionText: "Storytelling", isCorrect: false, language: "en" },
                  { optionText: "Monitoring", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Which are valid data science outcomes? (Select all that apply)",
                options: [
                  { optionText: "Forecasting demand", isCorrect: true, language: "en" },
                  { optionText: "Personalized recommendations", isCorrect: true, language: "en" },
                  { optionText: "Manual data entry", isCorrect: false, language: "en" },
                  { optionText: "Fraud detection", isCorrect: true, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Working with Data",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Data Types and Data Quality",
            description: `
              <p><strong>Duration:</strong> 35-45 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Data Types</h2>
              <ul>
                <li><p><strong>Structured:</strong> tables, rows, and columns.</p></li>
                <li><p><strong>Semi-structured:</strong> JSON logs and events.</p></li>
                <li><p><strong>Unstructured:</strong> text, images, audio.</p></li>
              </ul>
              <p></p>
              <h2>Quality Checks</h2>
              <ul>
                <li><p>Completeness: missing values and nulls.</p></li>
                <li><p>Consistency: the same format across sources.</p></li>
                <li><p>Validity: values match rules (for example, ages are positive).</p></li>
              </ul>
              <p></p>
              <h2>Case Example</h2>
              <p>A churn model trained on inconsistent date formats often underperforms. Quality checks prevent hidden errors early.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Data Cleaning Techniques",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Common Fixes</h2>
              <ul>
                <li><p>Handle missing values with imputation or removal.</p></li>
                <li><p>Normalize ranges for comparable scales.</p></li>
                <li><p>Deduplicate records and standardize categories.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Data Quality Quiz",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "Removing duplicates improves [word], while standardizing formats improves [word].",
                solutionExplanation:
                  "<p>Removing duplicates improves <strong>accuracy</strong>, while standardizing formats improves <strong>consistency</strong>.</p>",
                options: [
                  { optionText: "accuracy", isCorrect: true, language: "en" },
                  { optionText: "consistency", isCorrect: true, language: "en" },
                  { optionText: "latency", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Modeling Basics",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Supervised vs Unsupervised Learning",
            description: `
              <p><strong>Duration:</strong> 35-45 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Supervised Learning</h2>
              <p>Uses labeled examples to learn a mapping from inputs to outputs. Typical tasks include classification and regression.</p>
              <p></p>
              <h2>Unsupervised Learning</h2>
              <p>Finds structure in data without labels. Common tasks include clustering and dimensionality reduction.</p>
              <p></p>
              <h2>How to Choose</h2>
              <ul>
                <li><p>If you have labels and a clear target, choose supervised.</p></li>
                <li><p>If you need to discover patterns, choose unsupervised.</p></li>
              </ul>
            `,
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Model Selection Coach",
            aiMentorInstructions:
              "Help the learner decide which model type fits a given problem. Ask about the goal, available labels, and required output.",
            completionConditions:
              "Learner can explain the difference between supervised and unsupervised learning and select a model type for a simple scenario.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Modeling Basics Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which task is typically supervised learning?",
                options: [
                  { optionText: "Predicting house prices", isCorrect: true, language: "en" },
                  {
                    optionText: "Grouping customers by behavior",
                    isCorrect: false,
                    language: "en",
                  },
                  { optionText: "Finding anomalies", isCorrect: false, language: "en" },
                  { optionText: "Dimensionality reduction", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Web Development Essentials: Build Your First Site",
    description:
      "Learn the fundamentals of building modern web pages with HTML, CSS, and JavaScript. You will create a simple, responsive site and practice common patterns used across real projects.",
    status: "published",
    priceInCents: 9900,
    category: "Web Development",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "HTML and Semantics",
        isFreemium: true,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "HTML Structure and Semantics",
            description: `
              <p><strong>Duration:</strong> 35-45 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Why Semantics Matter</h2>
              <p>Semantic tags help browsers, search engines, and assistive technology understand your content.</p>
              <p></p>
              <h2>Core Elements</h2>
              <ul>
                <li><p><strong>header</strong> for top-level context.</p></li>
                <li><p><strong>nav</strong> for navigation links.</p></li>
                <li><p><strong>main</strong> for the primary content.</p></li>
                <li><p><strong>footer</strong> for supporting information.</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Outline a simple blog page using semantic sections before writing any CSS.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Semantic HTML Presentation",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Slides</h2>
              <p>See before and after examples that improve accessibility and search indexing.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "HTML Semantics Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which tag best represents site navigation?",
                options: [
                  { optionText: "<nav>", isCorrect: true, language: "en" },
                  { optionText: "<header>", isCorrect: false, language: "en" },
                  { optionText: "<section>", isCorrect: false, language: "en" },
                  { optionText: "<main>", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "CSS Layout and Design",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Box Model and Spacing",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>The Box Model</h2>
              <p>Every element is a rectangle with content, padding, border, and margin. Layout issues often come from misunderstood box sizing.</p>
              <p></p>
              <h2>Spacing Guidelines</h2>
              <ul>
                <li><p>Use padding to create space inside a component.</p></li>
                <li><p>Use margin to separate components from each other.</p></li>
                <li><p>Prefer consistent spacing scales (4, 8, 16, 24).</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Inspect a card component and adjust spacing until it feels balanced.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Flexbox and Grid Video",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>When to Use Each</h2>
              <ul>
                <li><p>Flexbox for one-dimensional layouts.</p></li>
                <li><p>Grid for two-dimensional layouts.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "CSS Layout Quiz",
            questions: [
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Which properties belong to the box model? (Select all that apply)",
                options: [
                  { optionText: "margin", isCorrect: true, language: "en" },
                  { optionText: "padding", isCorrect: true, language: "en" },
                  { optionText: "border", isCorrect: true, language: "en" },
                  { optionText: "opacity", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "JavaScript Foundations",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Variables, Types, and Functions",
            description: `
              <p><strong>Duration:</strong> 35-45 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Concepts</h2>
              <ul>
                <li><p>Variables store values you can reuse.</p></li>
                <li><p>Types describe the kind of data (string, number, boolean).</p></li>
                <li><p>Functions package logic into reusable blocks.</p></li>
              </ul>
              <p></p>
              <h2>Example</h2>
              <p>Create a function that converts minutes to seconds and returns the result.</p>
              <p></p>
              <h2>Practice</h2>
              <p>Write three variables with different types and log them to the console.</p>
            `,
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "JavaScript Practice Coach",
            aiMentorInstructions:
              "Guide the learner through writing simple functions and choosing appropriate data types. Ask for examples and correct common mistakes.",
            completionConditions:
              "Learner can write a function that accepts inputs, returns a value, and uses basic types.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "JavaScript Basics Quiz",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description: "A [word] stores data, while a [word] performs an action.",
                solutionExplanation:
                  "<p>A <strong>variable</strong> stores data, while a <strong>function</strong> performs an action.</p>",
                options: [
                  { optionText: "variable", isCorrect: true, language: "en" },
                  { optionText: "function", isCorrect: true, language: "en" },
                  { optionText: "selector", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Kotlin and Android: Build a Simple App",
    description:
      "Learn Kotlin fundamentals and how Android apps are structured. You will create a basic app layout and connect logic to user interactions.",
    status: "published",
    priceInCents: 0,
    category: "Mobile Development",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "Kotlin Fundamentals",
        isFreemium: true,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Kotlin Syntax and Types",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Why Kotlin</h2>
              <p>Kotlin is concise, null-safe, and fully interoperable with Java, which makes it a strong default for Android development.</p>
              <p></p>
              <h2>Key Language Features</h2>
              <ul>
                <li><p>Type inference and readable syntax.</p></li>
                <li><p>Null safety to reduce runtime crashes.</p></li>
                <li><p>Data classes for compact models.</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Declare a list of tasks and write a function that prints each item.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Kotlin Basics Video",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Watch</h2>
              <p>Follow along as we build a small Kotlin script and review common syntax patterns.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Kotlin Basics Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which keyword declares a read-only variable in Kotlin?",
                options: [
                  { optionText: "val", isCorrect: true, language: "en" },
                  { optionText: "var", isCorrect: false, language: "en" },
                  { optionText: "let", isCorrect: false, language: "en" },
                  { optionText: "const", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Android App Structure",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Activities, Views, and Layouts",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Building Blocks</h2>
              <ul>
                <li><p><strong>Activity</strong> is a screen with UI and logic.</p></li>
                <li><p><strong>Layout</strong> describes how views are arranged.</p></li>
                <li><p><strong>View</strong> is a button, text, image, or input.</p></li>
              </ul>
              <p></p>
              <h2>Example Flow</h2>
              <p>Open the app, load the activity, and inflate the XML layout to render the UI.</p>
              <p></p>
              <h2>Practice</h2>
              <p>Sketch a simple login screen and list the views you would use.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Android Project Tour",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Slides</h2>
              <p>Explore the AndroidManifest, Gradle files, and resource folders.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Android Structure Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which file defines the app's entry point?",
                options: [
                  { optionText: "AndroidManifest.xml", isCorrect: true, language: "en" },
                  { optionText: "build.gradle", isCorrect: false, language: "en" },
                  { optionText: "styles.xml", isCorrect: false, language: "en" },
                  { optionText: "settings.gradle", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Mathematics Foundations: Core Skills for Everyday Use",
    description:
      "Strengthen your math skills with focused lessons on arithmetic, geometry, and algebra. Each unit includes practice questions and short activities.",
    status: "published",
    priceInCents: 0,
    category: "Mathematics",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Arithmetic Essentials",
        isFreemium: true,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Numbers and Operations",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>What You Will Practice</h2>
              <ul>
                <li><p>Add, subtract, multiply, and divide whole numbers.</p></li>
                <li><p>Work with decimals and simple fractions.</p></li>
                <li><p>Estimate results to catch mistakes.</p></li>
              </ul>
              <p></p>
              <h2>Example</h2>
              <p>If a recipe calls for 1.5 cups and you double it, you need 3 cups.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Arithmetic Practice Video",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Watch</h2>
              <p>Follow step-by-step examples on budgeting, discounts, and unit conversions.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Arithmetic Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is 15% of 200?",
                options: [
                  { optionText: "30", isCorrect: true, language: "en" },
                  { optionText: "20", isCorrect: false, language: "en" },
                  { optionText: "25", isCorrect: false, language: "en" },
                  { optionText: "35", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Geometry Basics",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Shapes, Area, and Perimeter",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Formulas</h2>
              <ul>
                <li><p>Rectangle area = length x width.</p></li>
                <li><p>Triangle area = (base x height) / 2.</p></li>
                <li><p>Circle area = pi x r x r.</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Measure a table or notebook and calculate its area and perimeter.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Geometry Slides",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Slides</h2>
              <p>Review worked examples and quick reference formulas.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Geometry Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is the area of a rectangle with length 8 and width 5?",
                options: [
                  { optionText: "40", isCorrect: true, language: "en" },
                  { optionText: "13", isCorrect: false, language: "en" },
                  { optionText: "26", isCorrect: false, language: "en" },
                  { optionText: "18", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Algebra Essentials",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Variables and Expressions",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Key Ideas</h2>
              <ul>
                <li><p>Variables stand for unknown values.</p></li>
                <li><p>Expressions combine numbers, variables, and operators.</p></li>
                <li><p>Equations set two expressions equal to solve for a variable.</p></li>
              </ul>
              <p></p>
              <h2>Example</h2>
              <p>If x + 3 = 9, then x = 6.</p>
            `,
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Algebra Quiz",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In algebra, [word] represent unknown values, while [word] combine numbers and symbols.",
                solutionExplanation:
                  "<p>In algebra, <strong>variables</strong> represent unknown values, while <strong>expressions</strong> combine numbers and symbols.</p>",
                options: [
                  { optionText: "variables", isCorrect: true, language: "en" },
                  { optionText: "expressions", isCorrect: true, language: "en" },
                  { optionText: "integers", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Solving Simple Equations",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Watch</h2>
              <p>Follow a step-by-step walkthrough of solving one-variable equations.</p>
            `),
          },
        ],
      },
    ],
  },
  {
    title: "English Communication Basics",
    description:
      "Improve everyday English with practical lessons on grammar, vocabulary, and speaking. The course focuses on clear sentences, common word choices, and confidence in conversation.",
    status: "published",
    priceInCents: 0,
    category: "Language Learning",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "Grammar Essentials",
        isFreemium: true,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Parts of Speech",
            description: `
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Parts of Speech</h2>
              <ul>
                <li><p><strong>Nouns</strong> name people, places, or things.</p></li>
                <li><p><strong>Verbs</strong> show actions or states.</p></li>
                <li><p><strong>Adjectives</strong> describe nouns.</p></li>
                <li><p><strong>Adverbs</strong> modify verbs or adjectives.</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Write a sentence and label each word by its part of speech.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Grammar Video Guide",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Watch</h2>
              <p>Review sentence structure and common grammar mistakes.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Grammar Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which word is a verb in the sentence: 'They run every morning'?",
                options: [
                  { optionText: "run", isCorrect: true, language: "en" },
                  { optionText: "they", isCorrect: false, language: "en" },
                  { optionText: "every", isCorrect: false, language: "en" },
                  { optionText: "morning", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Vocabulary Building",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Everyday Words and Phrases",
            description: `
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Common Topics</h2>
              <ul>
                <li><p>Work: schedule, meeting, deadline.</p></li>
                <li><p>Travel: ticket, station, platform.</p></li>
                <li><p>Daily life: grocery, receipt, appointment.</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Write three sentences using new vocabulary words.</p>
            `,
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Vocabulary Presentation",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Slides</h2>
              <p>Explore synonyms, antonyms, and common collocations.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Vocabulary Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which word is a synonym for 'quick'?",
                options: [
                  { optionText: "fast", isCorrect: true, language: "en" },
                  { optionText: "slow", isCorrect: false, language: "en" },
                  { optionText: "heavy", isCorrect: false, language: "en" },
                  { optionText: "late", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Speaking and Listening",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Clear Pronunciation",
            description: `
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Pronunciation Basics</h2>
              <ul>
                <li><p>Use word stress to emphasize meaning.</p></li>
                <li><p>Practice vowel sounds and final consonants.</p></li>
                <li><p>Slow down to improve clarity.</p></li>
              </ul>
              <p></p>
              <h2>Practice</h2>
              <p>Record yourself reading a short paragraph and listen for unclear words.</p>
            `,
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Conversation Coach",
            aiMentorInstructions:
              "Practice short dialogues and help the learner form clear, polite responses. Encourage repetition and correction.",
            completionConditions:
              "Learner can respond to common prompts using complete sentences and appropriate vocabulary.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Pronunciation Check",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT,
                title: "Fill in the blank with the correct word.",
                description: "I [word] to the store every Saturday.",
                solutionExplanation: "I <strong>go</strong> to the store every Saturday.",
                options: [
                  { optionText: "go", isCorrect: true, language: "en" },
                  { optionText: "went", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
    ],
  },
];
