import { PERMISSIONS } from "@repo/shared";
import { useSyncExternalStore } from "react";

// Isolated UI fixtures only: no API requests and no email delivery.
const listeners = new Set<() => void>();
let revision = 0;
function update() {
  revision++;
  listeners.forEach((listener) => listener());
}
function useFixtures() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => revision,
  );
}
const query = <T>(data: T) => ({
  data,
  isPending: false,
  isError: false,
  refetch: async () => {
    update();
  },
});
const totals = { recipients: 2, sent: 2, clicked: 1, submitted: 0, risky: 1, riskRate: 50 };
const options = {
  users: [
    { id: "user-1", label: "Ada Example — ada@example.test" },
    { id: "user-2", label: "Jan Example — jan@example.test" },
  ],
  groups: [{ id: "group-1", label: "Security team", userIds: ["user-1", "user-2"] }],
  courses: [{ id: "course-1", label: "Security awareness" }],
};
const scenarios = [
  { id: "scenario-1", name: "Invoice reminder", description: "Example invoice scenario" },
];
const campaigns = [
  {
    id: "campaign-1",
    name: "Fixture campaign",
    status: "scheduled",
    sendWindow: { start: "2030-01-01T10:00:00Z", end: "2030-01-01T11:00:00Z" },
  },
];
export function usePhishingConfiguration() {
  const state = new URLSearchParams(location.search).get("state");
  return {
    ...query({ enabled: state !== "disabled" }),
    isPending: state === "loading",
    isError: state === "error",
  };
}
export function useCurrentUser() {
  return query({
    permissions: [
      PERMISSIONS.PHISHING_MANAGE,
      PERMISSIONS.PHISHING_REPORT_READ,
      PERMISSIONS.COURSE_ENROLLMENT,
    ],
  });
}
export function usePhishingOptions() {
  return query(options);
}
export function usePhishingScenarios() {
  return query(scenarios);
}
export function usePhishingCampaigns() {
  useFixtures();
  return query(campaigns);
}
export function usePhishingReport() {
  useFixtures();
  return query({
    campaign: campaigns[0],
    totals,
    groups: [{ id: "group-1", name: "Security team", totals }],
    recipients: [
      {
        userId: "user-1",
        firstName: "Ada",
        lastName: "Example",
        email: "ada@example.test",
        sentAt: "2030-01-01T10:00:00Z",
        clickedAt: "2030-01-01T10:05:00Z",
        submittedAt: null,
        courseStatus: "in_progress",
      },
      {
        userId: "user-2",
        firstName: "Jan",
        lastName: "Example",
        email: "jan@example.test",
        sentAt: null,
        clickedAt: null,
        submittedAt: null,
        courseStatus: "not_started",
      },
    ],
  });
}
export function useCreatePhishingCampaign() {
  return {
    isPending: false,
    mutateAsync: async (input: (typeof campaigns)[number]) => {
      campaigns.push({ ...input, id: `fixture-${campaigns.length}` });
      update();
    },
  };
}
export function useCancelPhishingCampaign() {
  return {
    isPending: false,
    mutateAsync: async () => {
      campaigns[0].status = "cancelled";
      update();
    },
  };
}
