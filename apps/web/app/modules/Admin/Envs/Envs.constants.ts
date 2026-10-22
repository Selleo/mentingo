export const SECRET_METADATA = {
  MICROSOFT_CLIENT_ID: {
    labelKey: "adminEnvsView.form.MICROSOFT_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  MICROSOFT_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.MICROSOFT_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  MICROSOFT_CALENDAR_CLIENT_ID: {
    labelKey: "adminEnvsView.form.MICROSOFT_CALENDAR_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  MICROSOFT_CALENDAR_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.MICROSOFT_CALENDAR_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  MICROSOFT_OAUTH_ENABLED: {
    labelKey: "adminEnvsView.form.MICROSOFT_OAUTH_ENABLED.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  VITE_MICROSOFT_OAUTH_ENABLED: {
    labelKey: "adminEnvsView.form.VITE_MICROSOFT_OAUTH_ENABLED.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  OPENAI_API_KEY: {
    labelKey: "adminEnvsView.form.OPENAI_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_API_KEY: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_READ_ONLY_API_KEY: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_READ_ONLY_API_KEY.label",
    descriptionKey: "adminEnvsView.form.BUNNY_STREAM_READ_ONLY_API_KEY.description",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_LIBRARY_ID: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_LIBRARY_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_TOKEN_SIGNING_KEY: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_TOKEN_SIGNING_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  BUNNY_STREAM_CDN_URL: {
    labelKey: "adminEnvsView.form.BUNNY_STREAM_CDN_URL.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  GOOGLE_CLIENT_ID: {
    labelKey: "adminEnvsView.form.GOOGLE_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  GOOGLE_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.GOOGLE_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  GOOGLE_OAUTH_ENABLED: {
    labelKey: "adminEnvsView.form.GOOGLE_OAUTH_ENABLED.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  VITE_GOOGLE_OAUTH_ENABLED: {
    labelKey: "adminEnvsView.form.VITE_GOOGLE_OAUTH_ENABLED.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  STRIPE_WEBHOOK_SECRET: {
    labelKey: "adminEnvsView.form.STRIPE_WEBHOOK_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  STRIPE_SECRET_KEY: {
    labelKey: "adminEnvsView.form.STRIPE_SECRET_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  VITE_STRIPE_PUBLISHABLE_KEY: {
    labelKey: "adminEnvsView.form.VITE_STRIPE_PUBLISHABLE_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  SLACK_CLIENT_ID: {
    labelKey: "adminEnvsView.form.SLACK_CLIENT_ID.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  SLACK_CLIENT_SECRET: {
    labelKey: "adminEnvsView.form.SLACK_CLIENT_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  SLACK_OAUTH_ENABLED: {
    labelKey: "adminEnvsView.form.SLACK_OAUTH_ENABLED.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  VITE_SLACK_OAUTH_ENABLED: {
    labelKey: "adminEnvsView.form.VITE_SLACK_OAUTH_ENABLED.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  PHISHING_API_KEY: {
    labelKey: "phishing.PHISHING_API_KEY",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  PHISHING_BASE_URL: {
    labelKey: "phishing.PHISHING_BASE_URL",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  PHISHING_WEBHOOK_SECRET: {
    labelKey: "phishing.PHISHING_WEBHOOK_SECRET",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  COMPETENCIES_BASE_URL: {
    labelKey: "adminEnvsView.form.COMPETENCIES_BASE_URL.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  COMPETENCIES_API_KEY: {
    labelKey: "adminEnvsView.form.COMPETENCIES_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LUMA_API_KEY: {
    labelKey: "adminEnvsView.form.LUMA_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LIVEKIT_URL: {
    labelKey: "adminEnvsView.form.LIVEKIT_URL.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LIVEKIT_API_KEY: {
    labelKey: "adminEnvsView.form.LIVEKIT_API_KEY.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
  LIVEKIT_API_SECRET: {
    labelKey: "adminEnvsView.form.LIVEKIT_API_SECRET.label",
    placeholderKey: "adminEnvsView.form.placeholder",
  },
};

type SecretName = keyof typeof SECRET_METADATA;

export const ENV_GROUPS = [
  {
    id: "googleSignIn",
    titleKey: "adminEnvsView.groups.googleSignIn.title",
    descriptionKey: "adminEnvsView.groups.googleSignIn.description",
    secretNames: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_OAUTH_ENABLED",
      "VITE_GOOGLE_OAUTH_ENABLED",
    ],
  },
  {
    id: "microsoftSignIn",
    titleKey: "adminEnvsView.groups.microsoftSignIn.title",
    descriptionKey: "adminEnvsView.groups.microsoftSignIn.description",
    secretNames: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_OAUTH_ENABLED",
      "VITE_MICROSOFT_OAUTH_ENABLED",
    ],
  },
  {
    id: "slackSignIn",
    titleKey: "adminEnvsView.groups.slackSignIn.title",
    descriptionKey: "adminEnvsView.groups.slackSignIn.description",
    secretNames: [
      "SLACK_CLIENT_ID",
      "SLACK_CLIENT_SECRET",
      "SLACK_OAUTH_ENABLED",
      "VITE_SLACK_OAUTH_ENABLED",
    ],
  },
  {
    id: "microsoftCalendar",
    titleKey: "adminEnvsView.groups.microsoftCalendar.title",
    descriptionKey: "adminEnvsView.groups.microsoftCalendar.description",
    secretNames: ["MICROSOFT_CALENDAR_CLIENT_ID", "MICROSOFT_CALENDAR_CLIENT_SECRET"],
  },
  {
    id: "payments",
    titleKey: "adminEnvsView.groups.payments.title",
    descriptionKey: "adminEnvsView.groups.payments.description",
    secretNames: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "VITE_STRIPE_PUBLISHABLE_KEY"],
  },
  {
    id: "videoStreaming",
    titleKey: "adminEnvsView.groups.videoStreaming.title",
    descriptionKey: "adminEnvsView.groups.videoStreaming.description",
    secretNames: [
      "BUNNY_STREAM_API_KEY",
      "BUNNY_STREAM_READ_ONLY_API_KEY",
      "BUNNY_STREAM_LIBRARY_ID",
      "BUNNY_STREAM_TOKEN_SIGNING_KEY",
      "BUNNY_STREAM_CDN_URL",
    ],
  },
  {
    id: "artificialIntelligence",
    titleKey: "adminEnvsView.groups.artificialIntelligence.title",
    descriptionKey: "adminEnvsView.groups.artificialIntelligence.description",
    secretNames: ["OPENAI_API_KEY", "LUMA_API_KEY"],
  },
  {
    id: "liveTraining",
    titleKey: "adminEnvsView.groups.liveTraining.title",
    descriptionKey: "adminEnvsView.groups.liveTraining.description",
    secretNames: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
  },
  {
    id: "phishingSimulations",
    titleKey: "adminEnvsView.groups.phishingSimulations.title",
    descriptionKey: "adminEnvsView.groups.phishingSimulations.description",
    secretNames: ["PHISHING_API_KEY", "PHISHING_BASE_URL", "PHISHING_WEBHOOK_SECRET"],
  },
  {
    id: "competencies",
    titleKey: "adminEnvsView.groups.competencies.title",
    descriptionKey: "adminEnvsView.groups.competencies.description",
    secretNames: ["COMPETENCIES_BASE_URL", "COMPETENCIES_API_KEY"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  titleKey: string;
  descriptionKey: string;
  secretNames: ReadonlyArray<SecretName>;
}>;
