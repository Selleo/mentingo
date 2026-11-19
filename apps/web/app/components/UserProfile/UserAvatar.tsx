import { useTranslation } from "react-i18next";

import { Gravatar } from "../Gravatar";
import { Avatar, AvatarImage } from "../ui/avatar";

interface UserAvatarProps {
  userName: string;
  profilePictureUrl?: string | null;
  className?: string;
}

export const UserAvatar = ({ userName, profilePictureUrl, className }: UserAvatarProps) => {
  const { t } = useTranslation();

  return (
    <Avatar className={className}>
      {profilePictureUrl ? (
        <AvatarImage
          src={profilePictureUrl}
          alt={t("a11y.avatarFor", { name: userName })}
          className="block size-full max-h-full max-w-full object-cover"
        />
      ) : (
        <Gravatar email="email@example.com" />
      )}
    </Avatar>
  );
};
