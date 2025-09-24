export type UpdateUserProfileBody = {
  firstName?: string;
  lastName?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  jobTitle?: string;
  userAvatar?: File | null;
};
