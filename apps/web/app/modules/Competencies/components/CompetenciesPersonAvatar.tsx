import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

export function CompetenciesPersonAvatar({
  name,
  profilePictureUrl,
  className,
}: {
  name: string;
  profilePictureUrl?: string | null;
  className?: string;
}) {
  return (
    <UserAvatar
      userName={name}
      profilePictureUrl={profilePictureUrl}
      className={cn("size-9 shrink-0", className)}
    />
  );
}
