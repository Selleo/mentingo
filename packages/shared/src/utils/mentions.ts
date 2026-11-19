export type MentionCandidate = {
  id: string;
  firstName: string;
  lastName: string;
};

type MentionName = Pick<MentionCandidate, "firstName" | "lastName">;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getMentionLabel = (user: MentionName) => `@${user.firstName} ${user.lastName}`;

export const buildMentionPattern = (users: MentionName[]): RegExp | null => {
  const labels = Array.from(new Set(users.map(getMentionLabel))).sort(
    (firstLabel, secondLabel) => secondLabel.length - firstLabel.length,
  );

  if (!labels.length) return null;

  return new RegExp(`(${labels.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`, "gu");
};

export const findMentionedUserIds = <TUser extends MentionCandidate>(
  content: string,
  users: TUser[],
): string[] => {
  const pattern = buildMentionPattern(users);

  if (!pattern) return [];

  const mentionedLabels = new Set(Array.from(content.matchAll(pattern), ([label]) => label));

  return users.filter((user) => mentionedLabels.has(getMentionLabel(user))).map((user) => user.id);
};
