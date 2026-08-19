import { Gravatar } from "../Gravatar";
import { Avatar, AvatarImage } from "../ui/avatar";

interface UserAvatarProps {
  userName: string;
  profilePictureUrl?: string | null;
  className?: string;
}

export const UserAvatar = ({ userName, profilePictureUrl, className }: UserAvatarProps) => (
  <Avatar className={className}>
    {profilePictureUrl ? (
      <AvatarImage
        src={profilePictureUrl}
        alt={`${userName} profile`}
        className="block size-full max-h-full max-w-full object-cover"
      />
    ) : (
      <Gravatar email="email@example.com" />
    )}
  </Avatar>
);
