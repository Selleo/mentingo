import { check, fail } from "k6";

export function checkSuccessResponse(response, expectedStatus = 200) {
  return check(response, {
    "status is 200": (r) => r.status === expectedStatus,
    "response has data": (r) => r.body && r.body.length > 0,
    "response is JSON": (r) => r.headers["Content-Type"]?.includes("application/json"),
  });
}

export function checkErrorResponse(response, expectedStatus = 400) {
  return check(response, {
    "status is error": (r) => r.status >= 400 && r.status < 500,
    "has error message": (r) => {
      try {
        const body = r.json();
        return !!body.error || !!body.message;
      } catch {
        return false;
      }
    },
  });
}

export function checkPaginatedResponse(response) {
  let valid = false;

  try {
    const body = response.json();
    valid = check(response, {
      "status is 200": (r) => r.status === 200,
      "has data array": (r) => Array.isArray(body.data),
      "has pagination": (r) => body.pagination || body.total !== undefined,
      "pagination has page": (r) => body.pagination?.page !== undefined || r.status !== 200,
    });
  } catch (e) {
    check(response, {
      "response is valid JSON": (r) => false,
    });
  }

  return valid;
}

export function checkResourceResponse(response, requiredFields = []) {
  let valid = false;

  try {
    const body = response.json();
    const data = body.data || body;

    const fieldChecks = {};

    fieldChecks["status is 200"] = (r) => r.status === 200;
    fieldChecks["has required fields"] = (r) => {
      if (requiredFields.length === 0) return true;
      return requiredFields.every((field) => field in data);
    };

    requiredFields.forEach((field) => {
      fieldChecks[`has ${field}`] = (r) => !!data[field];
    });

    valid = check(response, fieldChecks);
  } catch (e) {
    check(response, {
      "response is valid JSON": (r) => false,
    });
  }

  return valid;
}

export function checkAuthResponse(response) {
  let valid = false;

  try {
    const body = response.json();
    const data = body.data || body;

    valid = check(response, {
      "login successful": (r) => r.status === 200 || r.status === 201,
      "has user info": (r) => !!data.user || !!data.id || !!data.email,
    });
  } catch (e) {
    check(response, {
      "response is valid JSON": (r) => false,
    });
  }

  return valid;
}

export function checkCourseResponse(response) {
  return checkResourceResponse(response, ["id", "title", "description"]);
}

export function checkLessonResponse(response) {
  return checkResourceResponse(response, ["id", "title", "chapterId"]);
}

export function checkStatsResponse(response) {
  return checkResourceResponse(response, ["completedCourses", "inProgressCourses"]);
}

export function checkResponseTime(response, maxMs = 1000) {
  return check(response, {
    [`response time < ${maxMs}ms`]: (r) => r.timings.duration < maxMs,
  });
}

export function checkNoErrors(response) {
  try {
    const body = response.json();
    const hasErrors = !!body.error || !!body.errors || body.statusCode >= 400;

    if (hasErrors) {
      console.error(`API Error: ${JSON.stringify(body)}`);
    }

    return check(response, {
      "no API error": (r) => !hasErrors,
    });
  } catch (e) {
    return check(response, {
      "response is valid JSON": (r) => false,
    });
  }
}

export function checkResponseSchema(response, schema) {
  try {
    const body = response.json();
    const data = body.data || body;

    const checks = {};

    Object.keys(schema).forEach((field) => {
      const expectedType = schema[field];
      const actualType = typeof data[field];

      checks[`${field} is ${expectedType}`] = (r) => {
        if (expectedType === "array") {
          return Array.isArray(data[field]);
        }
        return actualType === expectedType || data[field] === null;
      };
    });

    return check(response, checks);
  } catch (e) {
    return check(response, {
      "response is valid JSON": (r) => false,
    });
  }
}

export function assertSuccess(response, message = "Request failed") {
  if (response.status < 200 || response.status >= 300) {
    fail(`${message} (Status: ${response.status})`);
  }
}

export function assertEquals(actual, expected, message = "") {
  if (actual !== expected) {
    fail(`Expected ${expected} but got ${actual}. ${message}`);
  }
}

export function checkAllEndpoints(response, options = {}) {
  const { expectedStatus = 200, maxResponseTime = 1000, requireFields = [] } = options;

  const checks = {
    "correct status": (r) => r.status === expectedStatus,
    [`response time < ${maxResponseTime}ms`]: (r) => r.timings.duration < maxResponseTime,
    "has body": (r) => r.body && r.body.length > 0,
  };

  if (requireFields.length > 0) {
    try {
      const body = response.json();
      const data = body.data || body;

      requireFields.forEach((field) => {
        checks[`has field ${field}`] = (r) => !!data[field];
      });
    } catch (e) {
      checks["response is JSON"] = (r) => false;
    }
  }

  const result = check(response, checks);

  // Log if status doesn't match expected
  if (response.status !== expectedStatus) {
    console.error(`[CHECK FAILED] Expected status ${expectedStatus}, got ${response.status}`);
  }

  return result;
}

export default {
  checkSuccessResponse,
  checkErrorResponse,
  checkPaginatedResponse,
  checkResourceResponse,
  checkAuthResponse,
  checkCourseResponse,
  checkLessonResponse,
  checkStatsResponse,
  checkResponseTime,
  checkNoErrors,
  checkResponseSchema,
  assertSuccess,
  assertEquals,
  checkAllEndpoints,
};
