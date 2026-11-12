import { BUILT_IN_EMAIL_TEMPLATE_KEYS } from "@repo/shared";

export const COURSE_COMPLETION_DELIVERY_SCENARIOS = [
  {
    administratorOptedIn: true,
    hasCertificate: true,
    learnerTemplateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.COMPLETION_WITH_CERTIFICATE,
  },
  {
    administratorOptedIn: true,
    hasCertificate: false,
    learnerTemplateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.COMPLETION_WITHOUT_CERTIFICATE,
  },
  {
    administratorOptedIn: false,
    hasCertificate: true,
    learnerTemplateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.COMPLETION_WITH_CERTIFICATE,
  },
  {
    administratorOptedIn: false,
    hasCertificate: false,
    learnerTemplateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.COMPLETION_WITHOUT_CERTIFICATE,
  },
] as const;

export const LEGACY_ADMIN_COMPLETION_EVENT_FIELDS = {
  course_name: "Leadership essentials",
  user_name: "Alex Smith",
  progress_link: "https://academy.example/course/leadership",
} as const;
