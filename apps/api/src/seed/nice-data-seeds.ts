import { faker } from "@faker-js/faker";
import * as dotenv from "dotenv";

import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QUESTION_TYPE } from "src/questions/schema/question.types";

import type { NiceCourseData } from "src/utils/types/test-types";

dotenv.config({ path: "./.env" });

export const niceCourses: NiceCourseData[] = [
  {
    title: "Fake test to certificate",
    description:
      "Fake test to certificate Fake test to certificate Fake test to certificate Fake test to certificate Fake test to certificate",
    status: "published",
    priceInCents: 0,
    category: "Data Science",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "Understanding Data and Its Importance",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "What is Data Science?",
            description:
              "Data science is an interdisciplinary field that uses scientific methods, processes, algorithms, and systems to extract knowledge and insights from structured and unstructured data. In this lesson, you'll learn about the fundamental concepts of data science, including data collection, cleaning, analysis, and interpretation. We'll explore how data science combines statistics, computer science, and domain expertise to solve complex problems and make data-driven decisions in various industries.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Data Science Basics Quiz",
            description: "Test your understanding of fundamental data science concepts.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which of the following is NOT a typical step in the data science process?",
                options: [
                  {
                    optionText: "Data collection",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Data cleaning",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Data analysis",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Data destruction",
                    isCorrect: true,
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
    title: "Introduction to Web Development: Building Your First Website",
    description:
      "In this beginner-friendly course, you will learn the basics of web development. We will guide you through creating a simple website from scratch using HTML, CSS, and a bit of JavaScript. No prior experience is needed—just a willingness to learn! By the end of the course, you’ll have built your own website and gained essential skills for further web development projects.",
    status: "published",
    priceInCents: 9900,
    category: "Web Development",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "HTML Basics: Building the Structure of Your Website",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Introduction to HTML",
            description:
              "HTML (HyperText Markup Language) is the standard language used to create the structure of web pages. In this lesson, you'll explore basic HTML elements and how they are used to build the framework of a website.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "HTML Quiz: Importance of HTML",
            description: "Why is HTML considered the backbone of any website?",
            questions: [
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title: "Why is HTML considered the backbone of any website?",
                description: "Explain its role in web development.",
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.AI_MENTOR,
            title: "HTML Basics",
            aiMentorInstructions:
              "Guide the learner through the basics of HTML structure, including elements, tags, and their roles in building a web page. Encourage questions and provide examples for each concept.",
            completionConditions:
              "Learner can identify and explain the purpose of basic HTML elements and successfully create a simple HTML page structure.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "CSS and Layout Quiz",
            description:
              "Test your knowledge of CSS concepts, including layout techniques and styling properties.",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In CSS, [word] is used to style the layout, while [word] is used to change colors.",
                solutionExplanation:
                  "<p>In CSS, <strong>flexbox</strong> is used to style the layout, while <strong>color properties</strong> are used to change colors.</p>",
                options: [
                  {
                    optionText: "flexbox",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "color properties",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "grid",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "flex",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Which CSS property is used to set the background color of an element?",
                options: [
                  {
                    optionText: "background-color",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "color",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "border-color",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "box-shadow",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "HTML Hyperlinks Presentation",
            description:
              "Learn the basics of web development with HTML! Master the structure and tags needed to build professional websites from scratch.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "HTML Tag Quiz",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which HTML tag is used to create a hyperlink?",
                options: [
                  {
                    optionText: "<a>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<link>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<button>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<input>",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which HTML tag is used to define a table row?",
                options: [
                  {
                    optionText: "<tr>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<td>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<table>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<th>",
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
      {
        title: "HTML Basics: Test Your Knowledge",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.QUIZ,
            title: "HTML Basics: Test Your Knowledge",
            description:
              "This lesson is designed to test your understanding of basic HTML concepts. You'll encounter a mix of multiple-choice and single-answer questions to evaluate your knowledge of HTML structure and common elements.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which of the following HTML tags is used to create an image?",
                options: [
                  {
                    optionText: "<img>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<picture>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<video>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<audio>",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title:
                  "Which of the following are valid HTML elements for structuring content? (Select all that apply)",
                options: [
                  {
                    optionText: "<html>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<head>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<body>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<title>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<h1>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<p>",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which HTML tag is used to create a hyperlink?",
                options: [
                  {
                    optionText: "<a>",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "<link>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<button>",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "<input>",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title:
                  "Which of the following attributes are commonly used with the <img> tag? (Select all that apply)",
                options: [
                  {
                    optionText: "alt",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "src",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "width",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "height",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "srcset",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "CSS is used to style [word], while JavaScript is used to add [word] to web pages.",
                solutionExplanation:
                  "<p>CSS is used to style <strong>HTML</strong>, while JavaScript is used to add <strong>interactivity</strong> to web pages.</p>",
                options: [
                  {
                    optionText: "HTML",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "interactivity",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "styles",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "functions",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "content",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "elements",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "animations",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In CSS, [word] is used to style the layout, while [word] is used to change colors.",
                solutionExplanation:
                  "<p>In CSS, <strong>flexbox</strong> is used to style the layout, while <strong>color properties</strong> are used to change colors.</p>",
                options: [
                  {
                    optionText: "flexbox",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "color properties",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In JavaScript, [word] are used to store data, while [word] are used to perform actions.",
                solutionExplanation:
                  "<p>In JavaScript, <strong>variables</strong> are used to store data, while <strong>functions</strong> are used to perform actions.</p>",
                options: [
                  {
                    optionText: "variables",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "functions",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "CSS Fundamentals: Put Your Skills to the Test",
        isFreemium: true,
        lessons: [
          {
            type: LESSON_TYPES.QUIZ,
            title: "CSS Fundamentals: Put Your Skills to the Test",
            description:
              "This lesson is a comprehensive quiz to evaluate your understanding of CSS fundamentals. You'll face a variety of question types covering selectors, properties, and layout techniques.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which CSS property is used to change the text color of an element?",
                options: [
                  {
                    optionText: "color",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "text-color",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "font-color",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "text-style",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Which of the following are valid CSS selectors? (Select all that apply)",
                options: [
                  {
                    optionText: ".class-name",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "#id-name",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "element",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "[attribute]",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "$variable",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "The CSS [word] property is used for creating flexible box layouts, while [word] is used for creating grid layouts.",
                solutionExplanation:
                  "<p>The CSS <strong>flexbox</strong> property is used for creating flexible box layouts, while <strong>color properties</strong> are used for creating grid layouts.</p>",
                options: [
                  {
                    optionText: "flexbox",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "color properties",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "grid",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "flex",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "To center an element horizontally, you can use 'margin: [word] [word];'.",
                solutionExplanation:
                  "<p>To center an element horizontally, you can use 'margin: <strong>0 auto</strong>;'.</p>",
                options: [
                  {
                    optionText: "0",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "auto",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "HTML Basics: Building the Structure of Your Website",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Introduction to HTML",
            description:
              "HTML (HyperText Markup Language) is the standard language used to create the structure of web pages. In this lesson, you'll explore basic HTML elements and how they are used to build the framework of a website.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "HTML Quiz: Importance of HTML",
            description: "",
            questions: [
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title:
                  "Why is HTML considered the backbone of any website? Explain its role in web development.",
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "CSS and Layout Quiz",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In CSS, [word] is used to style the layout, while [word] is used to change colors.",
                solutionExplanation:
                  "<p>In CSS, <strong>flexbox</strong> is used to style the layout, while <strong>color properties</strong> are used to change colors.</p>",
                options: [
                  {
                    optionText: "flexbox",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "color properties",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "grid",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "flex",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "The [word] property is used to set the spacing between lines of text, and the [word] property is used to set the spacing outside an element.",
                solutionExplanation:
                  "<p>In CSS, the <strong>line-height</strong> property is used to set the spacing between lines of text, while the <strong>margin</strong> property is used to set the spacing outside an element.</p>",
                options: [
                  {
                    optionText: "line-height",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "margin",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "padding",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "letter-spacing",
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
    title: "Mobile App Development: Creating Your First Android App",
    description:
      "Dive into the world of mobile app development with this beginner-friendly course. You'll learn the fundamentals of Android app development using Java and Android Studio. By the end of the course, you'll have created your own simple Android app and gained essential skills for future mobile development projects.",
    status: "published",
    priceInCents: 0,
    category: "Mobile Development",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Java Basics: Building Blocks of Android Development",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Introduction to Java for Android",
            description:
              "Java is the primary language used for Android app development. In this lesson, you'll learn about Java syntax, data types, and object-oriented programming principles that form the foundation of Android development.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Explain why Java is the preferred language for Android development",
            description: "",
            questions: [
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title: "Explain why Java is the preferred language for Android development.",
                description: "",
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In Java, [word] are used to define the blueprint of objects, while [word] are instances.",
                solutionExplanation:
                  "<p>In Java, <strong>classes</strong> are used to define the blueprint of objects, while <strong>objects</strong> are instances of these blueprints.</p>",
                options: [
                  {
                    optionText: "classes",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "objects",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In Android dev, [word] are used to define the user interface, while [word] handle user interactions.",
                solutionExplanation:
                  "<p>In Android development, <strong>layouts</strong> are used to define the user interface, while <strong>activities</strong> handle user interactions and app logic.</p>",
                options: [
                  {
                    optionText: "layouts",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "activities",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Java OOP Concepts Presentation",
            description: "Explore Object-Oriented Programming principles in Java.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Which keyword is used to create a new instance of a class in Java?",
            description: "",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which keyword is used to create a new instance of a class in Java?",
                options: [
                  {
                    optionText: "new",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "create",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "instance",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "object",
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
      {
        title: "Android Development Basics: Test Your Knowledge",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.QUIZ,
            title: "Which of the following is the entry point of an Android application?",
            description: "",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which of the following is the entry point of an Android application?",
                options: [
                  {
                    optionText: "Activity",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Service",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "BroadcastReceiver",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "ContentProvider",
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
    title: "Kotlin for Beginners: Modern Android Development",
    description:
      "Explore Kotlin, the modern and preferred language for Android development. This beginner-friendly course introduces Kotlin fundamentals and guides you through creating a basic Android app using Kotlin and Android Studio.",
    status: "published",
    priceInCents: 0,
    category: "Mobile Development",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "Getting Started with Kotlin Programming",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Introduction to Kotlin for Android",
            description:
              "Kotlin is a modern, concise language used for Android development. In this lesson, you'll learn about Kotlin syntax and basic concepts for creating Android apps.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Which keyword is used to declare a variable in Kotlin?",
            description: "",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which keyword is used to declare a variable in Kotlin?",
                options: [
                  { optionText: "var", isCorrect: true, language: "en" },
                  { optionText: "val", isCorrect: false, language: "en" },
                  { optionText: "let", isCorrect: false, language: "en" },
                  {
                    optionText: "data",
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
      {
        title: "Building Your First App with Kotlin",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Setting Up Your Android Studio Environment",
            description:
              "Learn how to configure Android Studio for Kotlin development and create your first Android project.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Creating a Simple Kotlin App",
            description: "A step-by-step guide to building your first Android app using Kotlin.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In Kotlin, [word] are immutable variables, while [word] are mutable variables.",
                solutionExplanation:
                  "<p>In Kotlin, <strong>val</strong> are immutable variables, while <strong>var</strong> are mutable variables.</p>",
                options: [
                  { optionText: "val", isCorrect: true, language: "en" },
                  { optionText: "var", isCorrect: true, language: "en" },
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
    title: "Mathematics for Beginners: Building a Strong Foundation",
    description:
      "Learn essential math concepts with this beginner-friendly course. Covering fundamental topics like arithmetic, geometry, and algebra, this course is designed to make math accessible and enjoyable. By the end, you'll have a solid understanding of foundational math skills needed for advanced learning.",
    status: "published",
    priceInCents: 0,
    category: "Mathematics",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Arithmetic Essentials: Numbers and Operations",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Introduction to Arithmetic",
            description:
              "Arithmetic is the foundation of mathematics. In this lesson, you'll learn about numbers, basic operations, and their properties.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Why is arithmetic considered the foundation of mathematics? ",
            description: "",
            questions: [
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title:
                  "Why is arithmetic fundamental in math? Give a real-life example of its use.",
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Math is the study of numbers, shapes, and quantities.",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In arithmetic, [word] is the result of addition, while [word] is the result of subtraction.",
                solutionExplanation:
                  "<p>In arithmetic, <strong>sum</strong> is the result of addition, while <strong>difference</strong> is the result of subtraction.</p>",
                options: [
                  { optionText: "sum", isCorrect: true, language: "en" },
                  {
                    optionText: "difference",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Geometry Basics: Shapes and Measurements",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Understanding Geometry",
            description:
              "Geometry involves the study of shapes, sizes, and the properties of space. In this lesson, you'll learn about basic geometric figures and their properties.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Geometric Shapes Presentation",
            description:
              "Explore various geometric shapes, their formulas for area and perimeter, and their real-life applications.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Which formula is used to calculate the area of a rectangle?",
            description: "",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which formula is used to calculate the area of a rectangle?",
                options: [
                  {
                    optionText: "length × width",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "length + width",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "length × height",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "2 × (length + width)",
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
      {
        title: "Algebra Introduction: Solving for the Unknown",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Getting Started with Algebra",
            description:
              "Algebra helps us solve problems by finding unknown values. In this lesson, you'll learn about variables, expressions, and simple equations.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In algebra, [word] represent unknown values, while [word] are mathematical phrases",
                solutionExplanation:
                  "<p>In algebra, <strong>variables</strong> represent unknown values, while <strong>expressions</strong> are mathematical phrases that combine numbers and variables.</p>",
                options: [
                  {
                    optionText: "variables",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "expressions",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Mathematics Basics Quiz: Test Your Knowledge",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.QUIZ,
            title: "Mathematics Basics Quiz: Test Your Knowledge",
            description:
              "Evaluate your understanding of arithmetic, geometry, and algebra with this comprehensive quiz.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which of the following is an example of a geometric shape?",
                options: [
                  {
                    optionText: "Triangle",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Variable",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Equation",
                    isCorrect: false,
                    language: "en",
                  },
                  { optionText: "Sum", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Which operations are included in basic arithmetic? (Select all that apply)",
                options: [
                  {
                    optionText: "Addition",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Subtraction",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Multiplication",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Division",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Integration",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "In algebra, [word] are used to represent unknowns, while [word] can be solved to find their values.",
                solutionExplanation:
                  "<p>In algebra, <strong>variables</strong> are used to represent unknowns, while <strong>equations</strong> can be solved to find their values.</p>",
                options: [
                  {
                    optionText: "variables",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "equations",
                    isCorrect: true,
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
    title: "English Basics: Building a Strong Foundation",
    description:
      "Learn the fundamentals of English with this beginner-friendly course. From grammar to vocabulary, you'll gain the essential skills needed for effective communication in English. By the end of the course, you'll be equipped with the confidence to navigate everyday conversations and writing tasks with ease.",
    status: "published",
    priceInCents: 0,
    category: "Language Learning",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "Mastering Basic Grammar Rules",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Introduction to English Grammar",
            description:
              "Learn the essential grammar rules that form the backbone of English communication, covering nouns, verbs, adjectives, and more.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Sentence Structure Basics",
            description:
              "Explore how sentences are structured, including subject-verb agreement and word order in affirmative, negative, and question forms.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Explain the difference between a noun and a verb in a sentence.",
            description: "Explain the difference between a noun and a verb in a sentence.",
            questions: [
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title: "Explain the difference between a noun and a verb in a sentence.",
                description: "Explain its role in sentence construction.",
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description: "Fill in the blanks: 'She [word] to the store yesterday.'",
                solutionExplanation: "<p>She <strong>went</strong> to the store yesterday.</p>",
                options: [
                  { optionText: "went", isCorrect: true, language: "en" },
                  { optionText: "go", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Building Vocabulary for Beginners",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Common English Words and Phrases",
            description:
              "A beginner-friendly list of common English words and phrases you can use in daily conversations.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Synonyms and Antonyms",
            description:
              "Learn about the importance of synonyms and antonyms in expanding your vocabulary and making your speech more varied.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "English Vocabulary Expansion Presentation",
            description: "A comprehensive slide presentation on expanding your vocabulary.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Which word is the synonym of 'happy'?",
            description: "Choose the correct synonym for 'happy'.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which word is the synonym of 'happy'?",
                options: [
                  {
                    optionText: "Joyful",
                    isCorrect: true,
                    language: "en",
                  },
                  { optionText: "Sad", isCorrect: false, language: "en" },
                  {
                    optionText: "Angry",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT,
                title: "Fill in the blanks with the correct word.",
                description: "I [word] to the park every day.",
                solutionExplanation: "I <strong>go</strong> to the park every day.",
                options: [
                  { optionText: "go", isCorrect: true, language: "en" },
                  {
                    optionText: "went",
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
      {
        title: "Mastering Pronunciation and Accent",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Essential Pronunciation Tips",
            description:
              "Learn how to pronounce English words correctly and improve your accent with practical tips and exercises.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Common Pronunciation Mistakes",
            description:
              "Identify and work on common pronunciation challenges for non-native English speakers.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title:
              "Which of the following sounds is most commonly mispronounced by non-native English speakers?",
            description: "Choose the sound that is most commonly mispronounced.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title:
                  "Which of the following sounds is most commonly mispronounced by non-native English speakers?",
                options: [
                  { optionText: "Th", isCorrect: true, language: "en" },
                  { optionText: "S", isCorrect: false, language: "en" },
                  { optionText: "K", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Choose the correct verb form.",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description: "I love [word] (swimming/swim).",
                solutionExplanation: "I love <strong>swimming</strong> (swimming/swim).",
                options: [
                  {
                    optionText: "swimming",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "swim",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "swam",
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
      {
        title: "English Basics Quiz",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.QUIZ,
            title:
              "Which part of speech is the word 'quickly' in the sentence 'She ran quickly to the store'?",
            description: "Choose the correct part of speech.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title:
                  "Which part of speech is the word 'quickly' in the sentence 'She ran quickly to the store'?",
                options: [
                  {
                    optionText: "Adverb",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Verb",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Adjective",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Fill in the blank with the correct verb.",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description: "She [word] to the park every day.",
                solutionExplanation: "She <strong>went</strong> to the park every day.",
                options: [
                  { optionText: "goes", isCorrect: true, language: "en" },
                  {
                    optionText: "went",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "What is the plural form of 'child'?",
            description: "Choose the correct plural form of 'child'.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is the plural form of 'child'?",
                options: [
                  {
                    optionText: "Children",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Childs",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Which of these words is a conjunction?",
            description: "Choose the correct conjunction.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which of these words is a conjunction?",
                options: [
                  { optionText: "And", isCorrect: true, language: "en" },
                  { optionText: "Run", isCorrect: false, language: "en" },
                  {
                    optionText: "Quickly",
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
    title: "Advanced English: Mastering Complex Language Skills",
    description:
      "Take your English proficiency to the next level with this advanced course. Dive deep into advanced grammar structures, vocabulary, idiomatic expressions, and perfect your writing and speaking skills. By the end of this course, you'll have the tools to express yourself with clarity, sophistication, and confidence.",
    status: "published",
    priceInCents: 0,
    category: "Language Learning",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    hasCertificate: true,
    chapters: [
      {
        title: "Elevate Your Writing: Advanced Clause Strategies",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.QUIZ,
            title: "Using Adverbial Clauses to Improve Sentence Fluency",
            description:
              "Understand how adverbial clauses function to show time, reason, contrast, and condition in sentences.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What does an adverbial clause typically express in a sentence?",
                options: [
                  {
                    optionText: "Time, reason, contrast, or condition",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "The subject of the sentence",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Additional information about nouns",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "The main action in a sentence",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Which of the following are examples of adverbial clause markers?",
                options: [
                  {
                    optionText: "Although",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "However",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Despite",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Because",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title: "Provide an example of a sentence using an adverbial clause of reason.",
                language: "en",
              },
              {
                type: QUESTION_TYPE.DETAILED_RESPONSE,
                title:
                  "Explain the role of adverbial clauses in improving sentence complexity and fluency. Provide examples to support your explanation.",
                language: "en",
              },
              {
                type: QUESTION_TYPE.TRUE_OR_FALSE,
                title: "Determine whether the sentence is correct or incorrect:",
                options: [
                  {
                    optionText: "Adverbial clauses are used to modify nouns.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText:
                      "Adverbial clauses provide information about the verb, adjective, or another adverb.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Noun clauses can modify adjectives and adverbs.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText:
                      "Relative clauses are used to introduce more detail about the noun they modify.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText:
                      "A sentence can have multiple adverbial clauses with different functions.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText:
                      "A noun clause can act as a subject, object, or complement in a sentence.",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT,
                title: "Fill blanks with the correct word.",
                description:
                  "The book was [word] by the author to explain complex [word] concepts.",
                solutionExplanation:
                  "The book was <strong>written</strong> by the author to explain complex <strong>grammatical</strong> concepts.",
                options: [
                  {
                    optionText: "written",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "grammatical",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "The [word] of the study focused on the effects of [word] in [word] language acquisition.",
                solutionExplanation:
                  "The <strong>focus</strong> of the study focused on the effects of <strong>context</strong> in <strong>second</strong> language acquisition.",
                options: [
                  {
                    optionText: "focus",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "context",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "second",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "method",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "learning",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "primary",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.PHOTO_QUESTION_SINGLE_CHOICE,
                title: "Which sentence correctly uses an adverbial clause?",
                description:
                  "Look at the image below. Which sentence correctly uses an adverbial clause?",
                photoS3Key:
                  process.env.NODE_ENV === "production"
                    ? "course/c862d10e-b0fc-460d-a317-9a234cab62f6.png"
                    : "course/ae6c4e46-a445-4621-ab3e-fc3f66296910.png",
                options: [
                  {
                    optionText: "She went to the park after she finished her homework.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "The book was on the table.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "I like reading books because it's relaxing.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "He plays basketball every weekend.",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.PHOTO_QUESTION_MULTIPLE_CHOICE,
                title: "Select the sentence that depict examples of relative clauses.",
                description:
                  "Look at the image below. Select all the sentences that depict examples of relative clauses.",
                photoS3Key:
                  process.env.NODE_ENV === "production"
                    ? "course/ac0a916c-fae9-410e-8b98-50fe9dfeb9a9.png"
                    : "course/7635f98b-03c4-4065-bfbb-e518b3124a1b.png",
                options: [
                  {
                    optionText: "The man who is wearing a red shirt is my brother.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "She enjoys playing the piano every evening.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "This is the book that changed my life.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "They are playing outside in the yard.",
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
      {
        title: "Advanced Grammar: Perfecting Sentence Structures",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Complex Sentences and Their Use",
            description:
              "Learn how to form and use complex sentences to convey more detailed thoughts and ideas effectively.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Relative Clauses and Modifiers",
            description:
              "A deep dive into relative clauses and modifiers, which help to add extra information to sentences.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Difference between a relative clause and a noun clause",
            description: "Explain the difference between relative and noun clauses.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is the difference between a relative clause and a noun clause?",
                options: [
                  {
                    optionText: "Relative clauses are used to modify nouns",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Relative clauses are used to introduce new information",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Noun clauses are used to modify nouns",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Noun clauses are used to introduce new information",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description: "The book [word] I borrowed yesterday was fascinating.",
                solutionExplanation:
                  "The book <strong>that</strong> I borrowed yesterday was fascinating.",
                options: [
                  { optionText: "that", isCorrect: true, language: "en" },
                  { optionText: "who", isCorrect: false, language: "en" },
                ],
                language: "en",
              },
            ],
          },
        ],
      },
      {
        title: "Vocabulary Expansion: Academic and Formal English",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Academic Vocabulary and Its Application",
            description:
              "Master vocabulary words commonly used in academic papers, essays, and formal discussions.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Using Formal Language in Communication",
            description:
              "Learn how to adjust your language for formal situations, such as presentations or professional meetings.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Academic Vocabulary List",
            description:
              "Download this list of academic vocabulary and explore their meanings and usage in context.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Which word is an example of academic vocabulary?",
            description: "Select the correct academic word.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "Which word is an example of academic vocabulary?",
                options: [
                  {
                    optionText: "Analyze",
                    isCorrect: true,
                    language: "en",
                  },
                  { optionText: "Run", isCorrect: false, language: "en" },
                  {
                    optionText: "Quick",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Test your knowledge",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description: "The results [word] the hypothesis.",
                solutionExplanation: "The results <strong>support</strong> the hypothesis.",
                options: [
                  {
                    optionText: "support",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "supported",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "supports",
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
      {
        title: "Mastering Idiomatic Expressions",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Understanding Idioms in Context",
            description:
              "Learn how idiomatic expressions are used in everyday conversations to sound more natural and fluent.",
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "Common Idioms and Their Meanings",
            description:
              "A list of frequently used idioms, their meanings, and examples of how to use them.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "What does the idiom 'break the ice' mean?",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What does the idiom 'break the ice' mean?",
                description: "Explain the meaning of the idiom 'break the ice'.",
                options: [
                  {
                    optionText: "A way to start a conversation.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "A way to end a conversation.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "A way to make a person feel better.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "An idiom for a person who is not interested in a conversation.",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title: "Which of the following is an example of a break the ice expression?",
                description: "Choose the correct example of a break the ice expression.",
                options: [
                  {
                    optionText: "I'm not interested in talking to you anymore.",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "I don't want to talk to you anymore.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "I'm not interested anymore in talking to you.",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "You're not interested in talking to me anymore.",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill in the blanks with the correct word.",
                description:
                  "The break the ice expression is used to [word] a person who is not interested in a conversation.",
                solutionExplanation:
                  "The break the ice expression is used to <strong>make</strong> a person feel better.",
                options: [
                  {
                    optionText: "make",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "feel",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "start",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "end",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Fill in the blank with the correct idiom.",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description: "She was [word] when she heard the good news.",
                solutionExplanation:
                  "She was <strong>over the moon</strong> when she heard the good news.",
                options: [
                  {
                    optionText: "over the moon",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "over the mooning",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "over the mooned",
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
    title: "Artificial Intelligence in Business: Fundamentals",
    description:
      "This beginner-friendly course introduces the basics of AI in business. Learn about key concepts, terminologies, and how AI is applied to improve efficiency, automate processes, and enhance decision-making in various industries. By the end, you'll understand AI's potential to transform your business.",
    status: "published",
    priceInCents: 12900,
    category: "Artificial Intelligence",
    language: "en",
    thumbnailS3Key: faker.image.urlPicsumPhotos(),
    chapters: [
      {
        title: "Understanding AI Basics",
        isFreemium: false,
        lessons: [
          {
            type: LESSON_TYPES.CONTENT,
            title: "Key Concepts and Terminologies in AI",
            description:
              '<p>Artificial Intelligence (AI) refers to the simulation of human intelligence in machines programmed to think, learn, and make decisions. Below are some key concepts and terminologies essential to understanding AI:</p><ul><li><strong>Machine Learning (ML):</strong> A subset of AI focused on creating algorithms that allow computers to learn from and make predictions based on data. Example: A recommendation system suggesting movies based on your viewing history.</li><li><strong>Neural Networks:</strong> Inspired by the human brain, these are algorithms designed to recognize patterns and process data in layers, enabling tasks like image and speech recognition.</li><li><strong>Natural Language Processing (NLP):</strong> This involves teaching machines to understand, interpret, and generate human language. Example: Virtual assistants like Alexa or Siri.</li><li><strong>Computer Vision:</strong> A field of AI that enables computers to interpret and process visual data, such as images and videos. Example: Facial recognition technology.</li><li><strong>Deep Learning:</strong> A more complex subset of ML that uses large neural networks to analyze massive amounts of data and solve intricate problems, such as self-driving cars.</li><li><strong>Supervised vs. Unsupervised Learning:</strong><br>- <strong>Supervised Learning:</strong> The AI is trained on labeled data (e.g., images labeled as "cat" or "dog").<br>- <strong>Unsupervised Learning:</strong> The AI identifies patterns in unlabeled data without explicit instructions.</li><li><strong>Big Data:</strong> The large volume of structured and unstructured data generated by businesses and devices, which is essential for training AI models.</li><li><strong>Automation:</strong> AI is often used to automate repetitive tasks, freeing up human resources for more complex activities.</li><li><strong>Ethics in AI:</strong> As AI becomes more powerful, ensuring its ethical use (e.g., avoiding bias in decision-making) is critical for building trust.</li></ul><h3>Why These Concepts Matter</h3><p>Understanding these basic AI terms is the first step toward recognizing how AI can be applied in business. Each concept represents a building block of AI\'s potential to transform industries by increasing efficiency, improving decision-making, and creating innovative solutions.</p>',
          },
          {
            type: LESSON_TYPES.CONTENT,
            title: "AI Applications Across Industries",
            description:
              "A presentation exploring real-world AI applications in sectors like healthcare, finance, and retail.",
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "AI Quiz: Primary Goal of AI in Business",
            description:
              "Test your understanding of the fundamental goal of AI in business applications.",
            questions: [
              {
                type: QUESTION_TYPE.SINGLE_CHOICE,
                title: "What is the primary goal of AI in business?",
                options: [
                  {
                    optionText: "Replace human workers",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Automate repetitive tasks",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Improve decision-making",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Eliminate operational costs",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "AI Quiz: Applications of AI",
            description: "Identify common AI applications in various business domains.",
            questions: [
              {
                type: QUESTION_TYPE.MULTIPLE_CHOICE,
                title:
                  "Which of the following are applications of AI in business? (Select all that apply)",
                options: [
                  {
                    optionText: "Customer service chatbots",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Predictive analytics",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Supply chain optimization",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Space exploration tools",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "AI Quiz: Can AI Function Without Data?",
            description: "Test your understanding of AI's reliance on data.",
            questions: [
              {
                type: QUESTION_TYPE.TRUE_OR_FALSE,
                title: "AI can function without any data input from humans.",
                options: [
                  {
                    optionText: "True",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "False",
                    isCorrect: true,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Photo Identification: AI Solutions",
            description: "Identify the AI-driven solution from the provided images.",
            questions: [
              {
                type: QUESTION_TYPE.PHOTO_QUESTION_SINGLE_CHOICE,
                title: "Which image represents an AI-driven chatbot?",
                options: [
                  {
                    optionText: "Image 1 (Chatbot Interface)",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Image 2 (Calculator)",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Image 3 (Spreadsheet)",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "AI Fill in the Blanks",
            questions: [
              {
                type: QUESTION_TYPE.FILL_IN_THE_BLANKS_DND,
                title: "Fill blanks with the correct word.",
                description:
                  "Complete the blanks: Artificial [word] refers to the ability of machines to mimic [word] intelligence.",
                solutionExplanation:
                  "Complete the blanks: Artificial <strong>intelligence</strong> refers to the ability of machines to mimic <strong>human</strong> intelligence.",
                options: [
                  {
                    optionText: "Intelligence",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Automation",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Learning",
                    isCorrect: false,
                    language: "en",
                  },
                  {
                    optionText: "Human",
                    isCorrect: true,
                    language: "en",
                  },
                  {
                    optionText: "Animal",
                    isCorrect: false,
                    language: "en",
                  },
                ],
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Brief Response: Why Businesses Adopt AI",
            description: "Explain in one sentence why businesses adopt AI.",
            questions: [
              {
                type: QUESTION_TYPE.BRIEF_RESPONSE,
                title: "In one sentence, explain why businesses are adopting AI.",
                language: "en",
              },
            ],
          },
          {
            type: LESSON_TYPES.QUIZ,
            title: "Detailed Response: AI's Role in an Industry",
            description: "Describe how AI can improve decision-making in a specific industry.",
            questions: [
              {
                type: QUESTION_TYPE.DETAILED_RESPONSE,
                title:
                  "Describe how AI can improve decision-making in a specific industry of your choice.",
                language: "en",
              },
            ],
          },
        ],
      },
    ],
  },
];
