import { group, sleep } from "k6";
import { authenticationTests, failedAuthenticationTests } from "../tests/auth.test.js";
import {
  courseTests,
  courseEnrollmentTests,
  courseStatisticsTests,
  adminCourseListingTests,
  contentCreatorCourseTests,
} from "../tests/courses.test.js";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

export function studentJourney() {
  group("Student User Journey", () => {
    // 1. Login (required for everything)
    authenticationTests("student");
    sleep(randomIntBetween(3, 8)); // User settles in after login

    // 2. Browse available courses (user reads course list)
    courseTests();
    sleep(randomIntBetween(8, 15)); // User reviews options before deciding

    // 3. Enroll in a course
    courseEnrollmentTests();
    sleep(randomIntBetween(5, 10)); // User verifies enrollment
  });
}

/**
 * Admin user journey with management operations
 */
export function adminJourney() {
  group("Admin User Journey", () => {
    // 1. Login as admin
    authenticationTests("admin");
    sleep(randomIntBetween(2, 5)); // Admin navigates to dashboard

    // 2. View all courses (admin reviews course list)
    adminCourseListingTests();
    sleep(randomIntBetween(10, 20)); // Admin analyzes course data

    // 3. Check course statistics (admin reviews metrics)
    courseStatisticsTests();
    sleep(randomIntBetween(8, 15)); // Admin reviews statistics and makes decisions
  });
}

/**
 * Content creator journey
 */
export function contentCreatorJourney() {
  group("Content Creator Journey", () => {
    // 1. Login as creator
    authenticationTests("contentCreator");
    sleep(randomIntBetween(2, 5)); // Creator navigates to content area

    // 2. Browse courses (view own courses, review content)
    contentCreatorCourseTests();
    sleep(randomIntBetween(10, 20)); // Creator reviews their course portfolio

    // 3. Check course statistics (analyze student engagement)
    courseStatisticsTests();
    sleep(randomIntBetween(8, 15)); // Creator analyzes performance metrics
  });
}

/**
 * Random user journey based on weighted distribution
 */
export function randomUserJourney() {
  const rand = randomIntBetween(0, 99);

  if (rand < 60) {
    // 60% student users
    studentJourney();
  } else if (rand < 85) {
    // 25% admin users
    adminJourney();
  } else {
    // 15% content creator users
    contentCreatorJourney();
  }
}

/**
 * Mixed workload with error scenarios
 */
export function mixedWorkloadWithErrors() {
  group("Mixed Workload with Error Handling", () => {
    // Test normal flow
    randomUserJourney();
    sleep(1);

    // Test failed authentication
    failedAuthenticationTests();
    sleep(0.5);
  });
}

export default {
  studentJourney,
  adminJourney,
  contentCreatorJourney,
  randomUserJourney,
  mixedWorkloadWithErrors,
};
