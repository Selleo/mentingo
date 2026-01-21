import { useCurrentUserSuspense } from "~/api/queries";

import { UserAvatar } from "./UserAvatar";

interface UserProfileProps {
  data?: {
    username: string;
    profilePictureUrl?: string | null;
    email: string;
  };
}

export const UserProfile = (userProfile: UserProfileProps) => {
  const { data: currentUser } = useCurrentUserSuspense();

  const isUserPassed = !!userProfile?.data;

  const username = isUserPassed
    ? (userProfile.data?.username ?? "")
    : `${currentUser.firstName} ${currentUser.lastName}`;
  const profilePictureUrl = isUserPassed
    ? userProfile.data?.profilePictureUrl
    : currentUser.profilePictureUrl;
  const email = isUserPassed ? userProfile.data?.email : currentUser.email;

  return (
    <div className="mt-auto flex w-full max-w-[268px] items-center justify-between rounded-md bg-primary-50 p-[18px]">
      <div className="flex min-w-0 gap-x-2">
        <UserAvatar userName={username} profilePictureUrl={profilePictureUrl} />
        <hgroup className="subtle flex min-w-0 flex-col">
          <h2 className="text-neutral-900">{username}</h2>
          <p className="min-w-0 truncate text-neutral-500">{email}</p>
        </hgroup>
      </div>
    </div>
  );
};
