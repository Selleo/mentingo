import { DIRECTORY_SYNC_SCOPE_TYPES } from "@repo/shared";

export const FAKE_PAGE_SIZE = 2;

export const ADMINISTRATOR_EMAIL = "it-admin@workspace.test";
export const DIRECTORY_CUSTOMER_ID = "C0workspace";

export const VALID_SERVICE_ACCOUNT_KEY = JSON.stringify({
  client_email: "directory-sync@project.iam.gserviceaccount.com",
  client_id: "1234567890",
  private_key: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----\n",
});

export const GOOGLE_USERS = [
  {
    id: "u-anna",
    primaryEmail: "Anna@Workspace.test",
    name: { givenName: "Anna", familyName: "Sales" },
    orgUnitPath: "/Sales",
  },
  {
    id: "u-bob",
    primaryEmail: "bob@workspace.test",
    name: { givenName: "Bob", familyName: "Enterprise" },
    orgUnitPath: "/Sales/Enterprise",
    suspended: true,
  },
  {
    id: "u-cara",
    primaryEmail: "cara@workspace.test",
    name: { givenName: "Cara", familyName: "Engineering" },
    orgUnitPath: "/Engineering",
    archived: true,
  },
  {
    id: "u-dan",
    primaryEmail: "dan@workspace.test",
    name: { givenName: "Dan", familyName: "Salesforce" },
    orgUnitPath: "/Salesforce",
  },
];

export const GOOGLE_ORGANIZATIONAL_UNITS = [
  { orgUnitId: "ou-sales", orgUnitPath: "/Sales", name: "Sales" },
  { orgUnitId: "ou-engineering", orgUnitPath: "/Engineering", name: "Engineering" },
];

export const GOOGLE_GROUP_MEMBERS: Record<string, { id: string; type: string }[]> = {
  "g-sales": [
    { id: "u-anna", type: "USER" },
    { id: "g-nested", type: "GROUP" },
    { id: "u-bob", type: "USER" },
  ],
  "g-engineering": [{ id: "u-cara", type: "USER" }],
};

export const SCOPE_CASES = [
  {
    title: "returns every user for the all-users scope",
    scopeType: DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS,
    scopeExternalIds: [],
    expectedExternalIds: ["u-anna", "u-bob", "u-cara", "u-dan"],
  },
  {
    title: "returns users in an org unit and its sub-units, not in similarly named ones",
    scopeType: DIRECTORY_SYNC_SCOPE_TYPES.ORGANIZATIONAL_UNITS,
    scopeExternalIds: ["ou-sales"],
    expectedExternalIds: ["u-anna", "u-bob"],
  },
  {
    title: "returns the user members of a group in scope",
    scopeType: DIRECTORY_SYNC_SCOPE_TYPES.GROUPS,
    scopeExternalIds: ["g-engineering"],
    expectedExternalIds: ["u-cara"],
  },
] as const;

export const MISSING_OBJECT_CASES = [
  {
    title: "reports a deleted org unit in scope",
    scopeType: DIRECTORY_SYNC_SCOPE_TYPES.ORGANIZATIONAL_UNITS,
    scopeExternalIds: ["ou-deleted"],
    trackedGroupIds: [],
    expectedMissingExternalIds: ["ou-deleted"],
  },
  {
    title: "reports a deleted group in scope",
    scopeType: DIRECTORY_SYNC_SCOPE_TYPES.GROUPS,
    scopeExternalIds: ["g-deleted"],
    trackedGroupIds: [],
    expectedMissingExternalIds: ["g-deleted"],
  },
  {
    title: "reports a deleted mapped group",
    scopeType: DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS,
    scopeExternalIds: [],
    trackedGroupIds: ["g-sales", "g-deleted"],
    expectedMissingExternalIds: ["g-deleted"],
  },
] as const;

export const SERVICE_ACCOUNT_KEY_CASES = [
  { title: "is missing", storedKey: null },
  { title: "is not a service account key", storedKey: '{"type":"authorized_user"}' },
] as const;
