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
  {
    title: "Fake test to certificate",
    description:
      "A short, fast course designed to complete quickly and unlock a certificate. Includes a brief overview and a short quiz.",
    status: "published",
    priceInCents: 0,
    category: "Quick Start",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "Quick Completion",
        isFreemium: true,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Fast Track Overview",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 5-10 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Goal</h2>
              <p>Complete a short lesson and a quick quiz to verify access to certificates.</p>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Slides</h2>
              <p></p>
              <h2>Checklist</h2>
              <ul>
                <li><p>Read the overview.</p></li>
                <li><p>Watch the short video.</p></li>
                <li><p>Open the slides.</p></li>
              </ul>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Fast Completion Quiz",
            description: "A quick check to finish the course.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What should you do to complete this course?",
                options: [
                  {
                    optionText: "Finish the lesson and pass the quiz",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Skip all content",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Submit a project",
                    isCorrect: false,
                    language: "en",
                  },
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
    title: "Digital Marketing Launchpad",
    description:
      "Learn how to plan, launch, and measure digital campaigns across common channels. Build practical skills in audience research, messaging, and performance tracking.",
    status: "published",
    priceInCents: 0,
    category: "Marketing",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Market Research and Positioning",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Audience and Personas",
            description: withPresentationLink(
              withVideoLink(`
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Goal</h2>
              <p>Define who you serve, what they need, and how they decide.</p>
              <p></p>
              <h2>Persona Basics</h2>
              <ul>
                <li><p>Demographics and context.</p></li>
                <li><p>Jobs-to-be-done and pain points.</p></li>
                <li><p>Decision triggers and objections.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Slides</h2>
              <p></p>
              <h2>Activity</h2>
              <p>Write one persona with a clear goal and two objections.</p>
            `),
            ),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Competitive Analysis",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>What to Compare</h2>
              <ul>
                <li><p>Positioning and pricing.</p></li>
                <li><p>Channel mix and ad messaging.</p></li>
                <li><p>Customer reviews and claims.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
              <p>Use a simple matrix to list strengths and gaps.</p>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Value Proposition and Messaging",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Message</h2>
              <p>A strong value proposition explains who it is for, the primary benefit, and why it is credible.</p>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Practice</h2>
              <p>Write one headline and one supporting sentence for your product.</p>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Positioning Quiz",
            description: "Check your understanding of personas and value propositions.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which element belongs in a persona?",
                options: [
                  { optionText: "Goals and pain points", isCorrect: true, language: "en" },
                  { optionText: "Company revenue", isCorrect: false, language: "en" },
                  { optionText: "Engineering roadmap", isCorrect: false, language: "en" },
                  { optionText: "Internal org chart", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Positioning Coach",
            aiMentorInstructions:
              "Help the learner refine a value proposition. Ask for the audience, benefit, and proof, then provide feedback.",
            completionConditions:
              "Learner produces a concise value proposition with a clear audience and benefit.",
          },
        ],
      },
      {
        title: "Channels and Campaigns",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Channel Basics",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Common Channels</h2>
              <ul>
                <li><p>Search, social, email, and partnerships.</p></li>
                <li><p>When each channel works best.</p></li>
                <li><p>Typical goals and costs.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
              <p>Compare strengths across channels.</p>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Email Campaign Structure",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Structure</h2>
              <ul>
                <li><p>Subject line, opening, CTA, and follow-up.</p></li>
                <li><p>Segmenting by audience intent.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Social Media Ads",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Creative Essentials</h2>
              <ul>
                <li><p>One message per ad.</p></li>
                <li><p>Strong visual hierarchy.</p></li>
                <li><p>Clear CTA aligned to intent.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Landing Page Fundamentals",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Structure</h2>
              <ul>
                <li><p>Headline, proof, benefits, and CTA.</p></li>
                <li><p>Remove distractions from the page.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Channels Quiz",
            description: "Identify which channel fits the goal.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which channel is best for nurturing existing leads?",
                options: [
                  { optionText: "Email", isCorrect: true, language: "en" },
                  { optionText: "Out-of-home", isCorrect: false, language: "en" },
                  { optionText: "Direct mail", isCorrect: false, language: "en" },
                  { optionText: "Cold calling", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Measurement and Optimization",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Key Metrics and KPIs",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Metrics</h2>
              <ul>
                <li><p>CAC, LTV, conversion rate, and ROAS.</p></li>
                <li><p>Track the full funnel, not just clicks.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "A/B Testing Basics",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>What to Test</h2>
              <ul>
                <li><p>Headlines, CTA copy, and layout.</p></li>
                <li><p>One change at a time.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Marketing Dashboards",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Dashboard Goals</h2>
              <ul>
                <li><p>Daily health metrics.</p></li>
                <li><p>Weekly progress toward goals.</p></li>
                <li><p>Clear alert thresholds.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Measurement Quiz",
            description: "Confirm understanding of basic marketing metrics.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What does ROAS measure?",
                options: [
                  { optionText: "Revenue per ad spend", isCorrect: true, language: "en" },
                  { optionText: "Clicks per email", isCorrect: false, language: "en" },
                  { optionText: "Sessions per day", isCorrect: false, language: "en" },
                  { optionText: "Cost per lead", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Optimization Coach",
            aiMentorInstructions:
              "Help the learner interpret a simple campaign report and identify one optimization.",
            completionConditions:
              "Learner can explain one metric change and propose a reasonable test.",
          },
        ],
      },
    ],
  },
  {
    title: "Product Management Fundamentals",
    description:
      "Learn how to define product strategy, prioritize roadmaps, and align teams around outcomes. Build skills for discovery, delivery, and measurement.",
    status: "published",
    priceInCents: 0,
    category: "Product Management",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Product Strategy and Vision",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Product Vision",
            description: withPresentationLink(
              withVideoLink(`
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Vision Statement</h2>
              <p>Define the change your product will create and who it serves.</p>
              <p></p>
              <h2>Vision Elements</h2>
              <ul>
                <li><p>Target audience and problem.</p></li>
                <li><p>Long-term impact.</p></li>
                <li><p>Guiding principles.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Slides</h2>
              <p></p>
              <h2>Activity</h2>
              <p>Draft a one-sentence product vision.</p>
            `),
            ),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Outcome-Based Goals",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Outcomes vs Outputs</h2>
              <p>Outcomes describe user or business change, not a feature list.</p>
              <p></p>
              <h2>Slides</h2>
              <p>Define one outcome and its leading indicators.</p>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Market and Customer Research",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Discovery Inputs</h2>
              <ul>
                <li><p>Interviews, surveys, and analytics.</p></li>
                <li><p>Support tickets and sales notes.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Strategy Quiz",
            description: "Check your understanding of vision and outcomes.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which is an outcome?",
                options: [
                  { optionText: "Increase activation by 10%", isCorrect: true, language: "en" },
                  { optionText: "Add a new dashboard", isCorrect: false, language: "en" },
                  { optionText: "Ship a new widget", isCorrect: false, language: "en" },
                  { optionText: "Refactor the API", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Vision Coach",
            aiMentorInstructions:
              "Guide the learner to refine a vision statement and connect it to measurable outcomes.",
            completionConditions:
              "Learner produces a clear vision and at least one measurable outcome.",
          },
        ],
      },
      {
        title: "Prioritization and Roadmaps",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Prioritization Frameworks",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 30-40 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Popular Frameworks</h2>
              <ul>
                <li><p>RICE, MoSCoW, and WSJF.</p></li>
                <li><p>Balance impact, effort, and risk.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Roadmap Types",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Roadmap Styles</h2>
              <ul>
                <li><p>Theme-based roadmaps.</p></li>
                <li><p>Outcome-based roadmaps.</p></li>
                <li><p>Release schedules.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Stakeholder Alignment",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Alignment Tips</h2>
              <ul>
                <li><p>Share tradeoffs early.</p></li>
                <li><p>Use data to explain choices.</p></li>
                <li><p>Document decisions and rationale.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Prioritization Quiz",
            description: "Practice choosing tradeoffs.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which input most affects RICE scoring?",
                options: [
                  { optionText: "Reach", isCorrect: true, language: "en" },
                  { optionText: "Logo color", isCorrect: false, language: "en" },
                  { optionText: "Team size", isCorrect: false, language: "en" },
                  { optionText: "Office location", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Roadmap Coach",
            aiMentorInstructions:
              "Help the learner rank a small set of features using a simple framework.",
            completionConditions: "Learner provides a ranked list with a short justification.",
          },
        ],
      },
      {
        title: "Delivery and Measurement",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "MVP Scoping",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Define the MVP</h2>
              <p>Identify the smallest set of features that validates the core hypothesis.</p>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Launch Planning",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Launch Checklist</h2>
              <ul>
                <li><p>Readiness, documentation, and support.</p></li>
                <li><p>Rollout and communication plan.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Measuring Success",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Measurement Plan</h2>
              <ul>
                <li><p>Define leading and lagging indicators.</p></li>
                <li><p>Set a baseline and review cadence.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Delivery Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is the MVP focused on?",
                options: [
                  { optionText: "Testing a core hypothesis", isCorrect: true, language: "en" },
                  { optionText: "Shipping every feature", isCorrect: false, language: "en" },
                  { optionText: "A full redesign", isCorrect: false, language: "en" },
                  { optionText: "Marketing only", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Launch Coach",
            aiMentorInstructions:
              "Ask the learner for a launch goal, then help build a simple checklist.",
            completionConditions:
              "Learner produces a checklist with at least three concrete launch tasks.",
          },
        ],
      },
    ],
  },
  {
    title: "UX Design Essentials",
    description:
      "Build core UX skills for research, interaction design, and usability testing. Learn how to design flows that are clear, accessible, and delightful.",
    status: "published",
    priceInCents: 0,
    category: "Design",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "User Research Fundamentals",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Research Planning",
            description: withPresentationLink(
              withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Define the Problem</h2>
              <p>Start with a clear question and decide which method fits best.</p>
              <p></p>
              <h2>Methods</h2>
              <ul>
                <li><p>Interviews and surveys.</p></li>
                <li><p>Observation and diary studies.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Slides</h2>
            `),
            ),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Interview Skills",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Interview Tips</h2>
              <ul>
                <li><p>Ask open-ended questions.</p></li>
                <li><p>Listen more than you talk.</p></li>
                <li><p>Probe for concrete examples.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Synthesis and Insights",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Turn Notes into Insights</h2>
              <ul>
                <li><p>Cluster quotes into themes.</p></li>
                <li><p>Highlight pain points and needs.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Research Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is a good interview question?",
                options: [
                  {
                    optionText: "Tell me about the last time you...",
                    isCorrect: true,
                    language: "en",
                  },
                  { optionText: "Do you like our design?", isCorrect: false, language: "en" },
                  { optionText: "Would you pay $20?", isCorrect: false, language: "en" },
                  { optionText: "Our app is great, right?", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Research Coach",
            aiMentorInstructions:
              "Help the learner refine a research question and propose a suitable method.",
            completionConditions:
              "Learner drafts one research question and picks an appropriate method.",
          },
        ],
      },
      {
        title: "Interaction Design",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "User Flows",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Flow Mapping</h2>
              <p>Map the steps users take to achieve a goal and remove friction.</p>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Wireframes and Layout",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Wireframe Basics</h2>
              <ul>
                <li><p>Focus on structure, not visuals.</p></li>
                <li><p>Use reusable patterns.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Accessibility Essentials",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Principles</h2>
              <ul>
                <li><p>Color contrast and readable type.</p></li>
                <li><p>Keyboard navigation.</p></li>
                <li><p>Clear focus states.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Interaction Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is the goal of a wireframe?",
                options: [
                  { optionText: "Define structure and layout", isCorrect: true, language: "en" },
                  { optionText: "Finalize colors", isCorrect: false, language: "en" },
                  { optionText: "Write production code", isCorrect: false, language: "en" },
                  { optionText: "Choose fonts", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Flow Coach",
            aiMentorInstructions:
              "Ask the learner to describe a user goal and help outline the flow steps.",
            completionConditions: "Learner provides a clear start-to-finish flow with key steps.",
          },
        ],
      },
      {
        title: "Usability Testing",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Test Planning",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Plan the Test</h2>
              <ul>
                <li><p>Define tasks and success criteria.</p></li>
                <li><p>Recruit the right users.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Moderation Tips",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Moderation</h2>
              <p>Stay neutral, let the user struggle, and ask clarifying questions after.</p>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Reporting Results",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Report Structure</h2>
              <ul>
                <li><p>Top findings and impact.</p></li>
                <li><p>Evidence and quotes.</p></li>
                <li><p>Suggested fixes.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Usability Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What should a usability task include?",
                options: [
                  { optionText: "A clear goal", isCorrect: true, language: "en" },
                  { optionText: "A design critique", isCorrect: false, language: "en" },
                  { optionText: "A logo selection", isCorrect: false, language: "en" },
                  { optionText: "An animation demo", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Testing Coach",
            aiMentorInstructions: "Help the learner write one usability task and success criteria.",
            completionConditions: "Learner produces a task statement with clear success criteria.",
          },
        ],
      },
    ],
  },
  {
    title: "Personal Finance Basics",
    description:
      "Build essential money skills: budgeting, saving, debt management, and investing. Learn practical steps to improve financial health.",
    status: "published",
    priceInCents: 0,
    category: "Finance",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Budgeting and Cash Flow",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Budget Basics",
            description: withPresentationLink(
              withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Idea</h2>
              <p>A budget is a plan for where your money goes, not a restriction.</p>
              <p></p>
              <h2>Categories</h2>
              <ul>
                <li><p>Needs, wants, and savings.</p></li>
                <li><p>Fixed vs variable expenses.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Slides</h2>
            `),
            ),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Tracking Expenses",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Tracking Methods</h2>
              <ul>
                <li><p>Spreadsheets and apps.</p></li>
                <li><p>Weekly check-ins.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Building an Emergency Fund",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Emergency Fund</h2>
              <p>Aim for 3-6 months of core expenses to cover unexpected events.</p>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Budgeting Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which expense is typically a need?",
                options: [
                  { optionText: "Rent", isCorrect: true, language: "en" },
                  { optionText: "Streaming services", isCorrect: false, language: "en" },
                  { optionText: "Dining out", isCorrect: false, language: "en" },
                  { optionText: "Concert tickets", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Budget Coach",
            aiMentorInstructions:
              "Help the learner build a simple monthly budget with needs, wants, and savings.",
            completionConditions:
              "Learner creates a budget outline with three categories and targets.",
          },
        ],
      },
      {
        title: "Debt and Credit",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Understanding Credit Scores",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Credit Score Basics</h2>
              <ul>
                <li><p>Payment history and utilization.</p></li>
                <li><p>Length of credit history.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Debt Paydown Strategies",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Strategies</h2>
              <ul>
                <li><p>Snowball: smallest balance first.</p></li>
                <li><p>Avalanche: highest interest first.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Avoiding Common Credit Mistakes",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Mistakes to Avoid</h2>
              <ul>
                <li><p>Missing payments.</p></li>
                <li><p>Maxing out credit cards.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Credit Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which factor most impacts a credit score?",
                options: [
                  { optionText: "Payment history", isCorrect: true, language: "en" },
                  { optionText: "Favorite bank", isCorrect: false, language: "en" },
                  { optionText: "Employer size", isCorrect: false, language: "en" },
                  { optionText: "Number of checking accounts", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Debt Strategy Coach",
            aiMentorInstructions:
              "Ask the learner about their debts and help choose between snowball and avalanche.",
            completionConditions: "Learner selects a payoff strategy and lists first two steps.",
          },
        ],
      },
      {
        title: "Saving and Investing",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Saving Goals",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Goal Setting</h2>
              <ul>
                <li><p>Short-term, mid-term, and long-term goals.</p></li>
                <li><p>Automate savings where possible.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Investing Basics",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Core Concepts</h2>
              <ul>
                <li><p>Risk, return, and diversification.</p></li>
                <li><p>Index funds and long-term growth.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Retirement Accounts",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Account Types</h2>
              <ul>
                <li><p>Employer plans and individual accounts.</p></li>
                <li><p>Tax advantages and matching.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Investing Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What does diversification reduce?",
                options: [
                  { optionText: "Risk", isCorrect: true, language: "en" },
                  { optionText: "Time", isCorrect: false, language: "en" },
                  { optionText: "Income", isCorrect: false, language: "en" },
                  { optionText: "Savings", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Savings Coach",
            aiMentorInstructions: "Help the learner pick a savings goal and a monthly target.",
            completionConditions: "Learner sets one goal with a realistic monthly savings amount.",
          },
        ],
      },
    ],
  },
  {
    title: "Cybersecurity Awareness",
    description:
      "Understand the most common security threats and how to protect yourself and your organization. Learn safe habits and incident response basics.",
    status: "published",
    priceInCents: 0,
    category: "Cybersecurity",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Threats and Risks",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Common Threats",
            description: withPresentationLink(
              withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Top Threats</h2>
              <ul>
                <li><p>Phishing and social engineering.</p></li>
                <li><p>Malware and ransomware.</p></li>
                <li><p>Password reuse.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Slides</h2>
            `),
            ),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Phishing Red Flags",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Red Flags</h2>
              <ul>
                <li><p>Urgency and threats.</p></li>
                <li><p>Suspicious links and attachments.</p></li>
                <li><p>Unexpected requests for credentials.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Safe Browsing",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Safe Habits</h2>
              <ul>
                <li><p>Keep software up to date.</p></li>
                <li><p>Use trusted networks.</p></li>
                <li><p>Verify URLs before logging in.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Threats Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which is a phishing sign?",
                options: [
                  { optionText: "Unexpected urgency", isCorrect: true, language: "en" },
                  { optionText: "A known sender", isCorrect: false, language: "en" },
                  { optionText: "A secure URL", isCorrect: false, language: "en" },
                  { optionText: "A normal invoice", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Threat Awareness Coach",
            aiMentorInstructions:
              "Present a short scenario and ask the learner to identify risks and safe actions.",
            completionConditions:
              "Learner identifies at least two risks and suggests safe responses.",
          },
        ],
      },
      {
        title: "Protecting Accounts",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Password Hygiene",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Best Practices</h2>
              <ul>
                <li><p>Use long, unique passwords.</p></li>
                <li><p>Enable multi-factor authentication.</p></li>
                <li><p>Use a password manager.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Multi-Factor Authentication",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Why MFA Works</h2>
              <p>It adds a second barrier even if a password is compromised.</p>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Device Security",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Device Safety</h2>
              <ul>
                <li><p>Lock screens and auto-updates.</p></li>
                <li><p>Encrypt storage.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Account Security Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which action improves account security most?",
                options: [
                  { optionText: "Enable MFA", isCorrect: true, language: "en" },
                  { optionText: "Reuse passwords", isCorrect: false, language: "en" },
                  { optionText: "Turn off updates", isCorrect: false, language: "en" },
                  { optionText: "Share credentials", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Security Setup Coach",
            aiMentorInstructions:
              "Help the learner list three actions to secure their accounts today.",
            completionConditions: "Learner provides three concrete security actions.",
          },
        ],
      },
      {
        title: "Incident Response",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Recognizing Incidents",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Signs of Trouble</h2>
              <ul>
                <li><p>Unexpected logins or password resets.</p></li>
                <li><p>Unusual device behavior.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Immediate Actions",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>First Steps</h2>
              <ul>
                <li><p>Report to the right team.</p></li>
                <li><p>Change credentials.</p></li>
                <li><p>Preserve evidence.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Post-Incident Review",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 15-25 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Review Process</h2>
              <ul>
                <li><p>Document what happened.</p></li>
                <li><p>Improve controls and training.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Incident Response Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What should you do first after a suspected breach?",
                options: [
                  {
                    optionText: "Report it through the proper channel",
                    isCorrect: true,
                    language: "en",
                  },
                  { optionText: "Delete evidence", isCorrect: false, language: "en" },
                  { optionText: "Ignore it", isCorrect: false, language: "en" },
                  { optionText: "Post on social media", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Incident Coach",
            aiMentorInstructions:
              "Ask the learner to describe an incident scenario and guide a response checklist.",
            completionConditions: "Learner lists at least three immediate response steps.",
          },
        ],
      },
    ],
  },
  {
    title: "Project Leadership Essentials",
    description:
      "Learn how to plan projects, lead teams, and communicate progress. Build skills in scope, risk, and delivery.",
    status: "published",
    priceInCents: 0,
    category: "Leadership",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Planning and Scope",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Project Scope",
            description: withPresentationLink(
              withVideoLink(`
              <p><strong>Duration:</strong> 25-35 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Scope Definition</h2>
              <p>Clarify what is in scope, out of scope, and the success criteria.</p>
              <p></p>
              <h2>Watch</h2>
              <p></p>
              <h2>Slides</h2>
            `),
            ),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Milestones and Timelines",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Timeline Basics</h2>
              <ul>
                <li><p>Define phases and key deliverables.</p></li>
                <li><p>Estimate time and dependencies.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Resource Planning",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Resources</h2>
              <p>Align people, tools, and budget to the plan.</p>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Planning Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What should a scope statement include?",
                options: [
                  {
                    optionText: "In-scope and out-of-scope items",
                    isCorrect: true,
                    language: "en",
                  },
                  { optionText: "Only tasks", isCorrect: false, language: "en" },
                  { optionText: "Only budget", isCorrect: false, language: "en" },
                  { optionText: "Only team names", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Planning Coach",
            aiMentorInstructions:
              "Help the learner outline scope, milestones, and risks for a simple project.",
            completionConditions: "Learner provides a short scope statement and three milestones.",
          },
        ],
      },
      {
        title: "Team Leadership",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Roles and Responsibilities",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Role Clarity</h2>
              <ul>
                <li><p>Define ownership and decision rights.</p></li>
                <li><p>Use a RACI or similar model.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Communication Cadence",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Cadence</h2>
              <ul>
                <li><p>Weekly updates and demos.</p></li>
                <li><p>Clear decisions and notes.</p></li>
              </ul>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Managing Conflict",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Conflict Handling</h2>
              <ul>
                <li><p>Focus on facts, not opinions.</p></li>
                <li><p>Surface tradeoffs early.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Leadership Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is the goal of a RACI?",
                options: [
                  { optionText: "Clarify responsibility", isCorrect: true, language: "en" },
                  { optionText: "Set salary bands", isCorrect: false, language: "en" },
                  { optionText: "Choose tools", isCorrect: false, language: "en" },
                  { optionText: "Track bugs", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Team Coach",
            aiMentorInstructions:
              "Ask the learner to describe a team challenge and guide a resolution plan.",
            completionConditions: "Learner provides a clear resolution approach and next steps.",
          },
        ],
      },
      {
        title: "Risk and Delivery",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Risk Identification",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Risk Categories</h2>
              <ul>
                <li><p>Scope, schedule, and technical risks.</p></li>
                <li><p>People and dependency risks.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Status Reporting",
            description: withVideoLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Status Updates</h2>
              <p>Use a simple format: progress, risks, next steps.</p>
              <p></p>
              <h2>Watch</h2>
            `),
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Delivery Retrospectives",
            description: withPresentationLink(`
              <p><strong>Duration:</strong> 20-30 minutes<br><strong>Level:</strong> Beginner</p>
              <p></p>
              <h2>Retro Outcomes</h2>
              <ul>
                <li><p>What worked well.</p></li>
                <li><p>What to improve next time.</p></li>
              </ul>
              <p></p>
              <h2>Slides</h2>
            `),
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Delivery Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which is a standard status update element?",
                options: [
                  { optionText: "Risks", isCorrect: true, language: "en" },
                  { optionText: "Favorite movie", isCorrect: false, language: "en" },
                  { optionText: "Personal goals", isCorrect: false, language: "en" },
                  { optionText: "Team hobbies", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "Delivery Coach",
            aiMentorInstructions:
              "Help the learner draft a short status update with progress and risks.",
            completionConditions:
              "Learner writes a concise update with at least one risk and next step.",
          },
        ],
      },
    ],
  },
];
