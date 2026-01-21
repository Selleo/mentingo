import { group, check, sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { getEnvironment, apiEndpoints } from "../../config/environments.js";
import { authenticatedRequest, setupUserSession } from "../utils/auth.js";
import {
  checkPaginatedResponse,
  checkResourceResponse,
  checkCourseResponse,
  checkAllEndpoints,
  checkSuccessResponse,
} from "../utils/check-helpers.js";
import { getTestUser, randomArrayElement } from "../utils/data-generators.js";

const env = getEnvironment();

function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

const DEFAULT_PAGE = getEnvVar("DEFAULT_PAGE", "1");
const DEFAULT_PER_PAGE = getEnvVar("DEFAULT_PER_PAGE", "10");
const DEFAULT_LANGUAGE = getEnvVar("DEFAULT_LANGUAGE", "en");

export function courseTests() {
  group("Course Endpoints", () => {
    const testUser = getTestUser("student");

    setupUserSession(testUser.email, testUser.password, "student");

    let courseIdFromAvailable = null;

    group("Get Available Courses", () => {
      const url = `${env.baseUrl}${apiEndpoints.course.availableCourses}?page=${DEFAULT_PAGE}&perPage=${DEFAULT_PER_PAGE}&language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "student");

      checkPaginatedResponse(response);
      checkAllEndpoints(response, {
        expectedStatus: 200,
        maxResponseTime: 1000,
      });

      try {
        const body = response.json();
        if (body.data && Array.isArray(body.data) && body.data.length > 0) {
          courseIdFromAvailable = body.data[0].id;
          console.log(`[Test] Got course ID from available courses: ${courseIdFromAvailable}`);
        }
      } catch (e) {
        console.log(`[Test] Could not extract course ID: ${e}`);
      }
    });

    sleep(randomIntBetween(5, 10)); // User reads course list

    group("Get Student Courses", () => {
      const url = `${env.baseUrl}${apiEndpoints.course.studentCourses}?page=${DEFAULT_PAGE}&perPage=${DEFAULT_PER_PAGE}&language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "student");

      checkPaginatedResponse(response);
      checkAllEndpoints(response, {
        expectedStatus: 200,
        maxResponseTime: 1000,
      });

      check(response, {
        "student courses response valid": (r) => r.status === 200,
        "has courses data": (r) => {
          try {
            const body = r.json();
            return Array.isArray(body.data) || Array.isArray(body.courses);
          } catch {
            return false;
          }
        },
      });
    });

    sleep(randomIntBetween(3, 8)); // User reviews their enrolled courses

    group("Get Course Details", () => {
      if (!courseIdFromAvailable) {
        console.log(`[Test] Skipping course details - no course ID available`);
        return;
      }

      const url = `${env.baseUrl}${apiEndpoints.course.getCourseById}?id=${courseIdFromAvailable}&language=en`;

      const response = authenticatedRequest("GET", url, null, "student");

      check(response, {
        "get course successful": (r) => r.status === 200 || r.status === 404,
      });

      if (response.status === 200) {
        checkCourseResponse(response);
      }
    });

    sleep(randomIntBetween(10, 20)); // User reads course details carefully
  });
}

export function courseEnrollmentTests() {
  group("Course Enrollment", () => {
    const testUser = getTestUser("student");

    // Setup user session
    setupUserSession(testUser.email, testUser.password, "student");

    let courseIdForEnroll = null;

    group("Get Available Course for Enrollment", () => {
      const url = `${env.baseUrl}${apiEndpoints.course.availableCourses}?page=${DEFAULT_PAGE}&perPage=${DEFAULT_PER_PAGE}&language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "student");

      try {
        const body = response.json();
        if (body.data && Array.isArray(body.data) && body.data.length > 0) {
          courseIdForEnroll = body.data[0].id;
          console.log(`[Test] Got course ID for enrollment: ${courseIdForEnroll}`);
        }
      } catch (e) {
        console.log(`[Test] Could not extract course ID for enrollment: ${e}`);
      }
    });

    sleep(randomIntBetween(5, 12)); // User decides which course to enroll in

    group("Enroll in Course", () => {
      if (!courseIdForEnroll) {
        console.log(`[Test] Skipping enrollment - no course ID available`);
        return;
      }

      const url = `${env.baseUrl}${apiEndpoints.course.enrollCourse}?id=${courseIdForEnroll}`;

      const response = authenticatedRequest("POST", url, "{}", "student");

      check(response, {
        "enrollment successful": (r) => r.status === 200 || r.status === 201 || r.status === 409,
        "has response": (r) => r.body && r.body.length > 0,
      });
    });

    sleep(randomIntBetween(2, 5)); // User verifies enrollment
  });
}

export function courseStatisticsTests() {
  group("Course Statistics", () => {
    const testAdmin = getTestUser("admin");

    setupUserSession(testAdmin.email, testAdmin.password, "admin");

    let courseIdForStats = null;

    group("Get All Courses for Statistics", () => {
      const url = `${env.baseUrl}${apiEndpoints.course.all}?page=${DEFAULT_PAGE}&perPage=${DEFAULT_PER_PAGE}&language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "admin");

      try {
        const body = response.json();
        if (body.data && Array.isArray(body.data) && body.data.length > 0) {
          courseIdForStats = body.data[0].id;
          console.log(`[Test] Got course ID for statistics: ${courseIdForStats}`);
        }
      } catch (e) {
        console.log(`[Test] Could not extract course ID for statistics: ${e}`);
      }
    });

    sleep(randomIntBetween(3, 8)); // Admin reviews course data

    group("Get Course Statistics", () => {
      if (!courseIdForStats) {
        console.log(`[Test] Skipping course statistics - no course ID available`);
        return;
      }

      const url = `${env.baseUrl}${apiEndpoints.course.courseStatistics.replace(":courseId", courseIdForStats)}`;

      const response = authenticatedRequest("GET", url, null, "admin");

      check(response, {
        "get statistics successful": (r) =>
          r.status === 200 || r.status === 403 || r.status === 404,
        "response time acceptable": (r) => r.timings.duration < 2000,
      });
    });

    sleep(randomIntBetween(5, 10)); // Admin analyzes statistics

    group("Get Average Quiz Scores", () => {
      if (!courseIdForStats) {
        console.log(`[Test] Skipping average quiz scores - no course ID available`);
        return;
      }

      const url = `${env.baseUrl}${apiEndpoints.course.averageQuizScore.replace(":courseId", courseIdForStats)}?language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "admin");

      check(response, {
        "get average scores successful": (r) =>
          r.status === 200 || r.status === 403 || r.status === 404,
      });
    });

    sleep(randomIntBetween(4, 8)); // Admin reviews quiz performance

    group("Get Students Progress", () => {
      if (!courseIdForStats) {
        console.log(`[Test] Skipping students progress - no course ID available`);
        return;
      }

      const url = `${env.baseUrl}${apiEndpoints.course.studentsProgress.replace(":courseId", courseIdForStats)}?page=${DEFAULT_PAGE}&perPage=${DEFAULT_PER_PAGE}&language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "admin");

      check(response, {
        "get students progress successful": (r) =>
          r.status === 200 || r.status === 403 || r.status === 404,
        "response time acceptable": (r) => r.timings.duration < 2000,
      });
    });

    sleep(randomIntBetween(5, 12)); // Admin reviews student progress data
  });
}

export function adminCourseListingTests() {
  group("Admin Course Listing", () => {
    const testAdmin = getTestUser("admin");

    setupUserSession(testAdmin.email, testAdmin.password, "admin");

    group("Get All Courses", () => {
      const url = `${env.baseUrl}${apiEndpoints.course.all}?page=${DEFAULT_PAGE}&perPage=${DEFAULT_PER_PAGE}&language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "admin");

      checkPaginatedResponse(response);
      checkAllEndpoints(response, {
        expectedStatus: 200,
        maxResponseTime: 1500,
      });
    });

    sleep(randomIntBetween(3, 8)); // Admin reviews course listing data
  });
}

export function contentCreatorCourseTests() {
  group("Content Creator Courses", () => {
    const testCreator = getTestUser("contentCreator");

    setupUserSession(testCreator.email, testCreator.password, "contentCreator");

    group("Get Content Creator Courses", () => {
      const url = `${env.baseUrl}${apiEndpoints.course.all}?page=${DEFAULT_PAGE}&perPage=${DEFAULT_PER_PAGE}&language=${DEFAULT_LANGUAGE}`;

      const response = authenticatedRequest("GET", url, null, "contentCreator");

      check(response, {
        "get creator courses successful": (r) => r.status === 200 || r.status === 403,
      });
    });

    sleep(randomIntBetween(5, 12)); // Creator reviews their course portfolio
  });
}

export default {
  courseTests,
  courseEnrollmentTests,
  courseStatisticsTests,
  adminCourseListingTests,
  contentCreatorCourseTests,
};
