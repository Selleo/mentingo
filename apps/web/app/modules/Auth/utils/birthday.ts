/**
 * Parse a birthday string in "YYYY-MM-DD" format into a Date.
 * @param birthday - Birthday string in "YYYY-MM-DD" format.
 * @returns Date when valid; otherwise null.
 */
export const parseBirthday = (birthday?: string) => {
  if (!birthday) return null;

  const [year, month, day] = birthday.split("-").map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) return null;

  const birth = new Date(year, month - 1, day);

  if (Number.isNaN(birth.getTime())) return null;

  return birth;
};

/**
 * Calculate age in full years from a birthday string.
 * @param birthday - Birthday string in "YYYY-MM-DD" format.
 * @returns Age in years when valid; otherwise null.
 */
export const calculateAge = (birthday?: string) => {
  const birth = parseBirthday(birthday);

  if (!birth) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();

  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

  if (!hadBirthdayThisYear) age--;

  return age;
};
