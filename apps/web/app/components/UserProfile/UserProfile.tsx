import { useCurrentUserSuspense } from "~/api/queries";

import { UserAvatar } from "./UserAvatar";

export const UserProfile = () => {
  const {
    data: { firstName, lastName, email, profilePictureUrl },
  } = useCurrentUserSuspense();

  return (
    <div className="mt-auto flex w-full max-w-[268px] items-center justify-between rounded-md bg-primary-50 p-[18px]">
      <div className="flex min-w-0 gap-x-2">
        <UserAvatar userName={`${firstName} ${lastName}`} profilePictureUrl={profilePictureUrl} />
        <hgroup className="subtle flex min-w-0 flex-col">
          <h2 className="text-neutral-900">
            {firstName} {lastName}
          </h2>
          <p className="min-w-0 truncate text-neutral-500">{email}</p>
        </hgroup>
      </div>
    </div>
  );
};
