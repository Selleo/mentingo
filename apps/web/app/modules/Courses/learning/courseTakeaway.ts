const apiUrl = import.meta.env.VITE_API_URL;
const takeawayBaseUrl = apiUrl ? `${apiUrl}/api/course/takeaway` : "/api/course/takeaway";

const STORAGE_PREFIX = "mentingo:course-takeaway:v1";

function getStorageKey(params: { userId?: string; courseId: string }) {
  const userKey = params.userId ?? "anon";
  return `${STORAGE_PREFIX}:${userKey}:${params.courseId}`;
}

export function getCourseTakeawayLocalFallback(params: { userId?: string; courseId: string }) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(getStorageKey(params)) ?? "";
  } catch {
    return "";
  }
}

export async function fetchCourseTakeaway(params: { courseId: string }) {
  const res = await fetch(`${takeawayBaseUrl}?courseId=${encodeURIComponent(params.courseId)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch course takeaway (${res.status})`);
  const json = (await res.json()) as { data?: { content?: string } };
  return String(json?.data?.content ?? "");
}

export async function saveCourseTakeaway(params: { userId?: string; courseId: string; value: string }) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(getStorageKey(params), params.value);
    } catch {
      // ignore
    }
  }

  const res = await fetch(takeawayBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ courseId: params.courseId, content: params.value }),
  });
  if (!res.ok) throw new Error(`Failed to save course takeaway (${res.status})`);
}

