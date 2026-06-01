import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

type ParticipantAvatarProps = {
  participantName: string;
  participantInitials: string;
  profilePictureUrl?: string | null;
  size: "sm" | "lg" | "fullscreen";
};

export function ParticipantAvatar({
  participantName,
  participantInitials,
  profilePictureUrl,
  size,
}: ParticipantAvatarProps) {
  return (
    <Avatar
      className={cn("shrink-0 bg-primary-800 ring-1 ring-primary-200/20", {
        "size-7": size === "sm",
        "size-20": size === "lg",
        "size-32": size === "fullscreen",
      })}
    >
      {profilePictureUrl && (
        <AvatarImage
          src={profilePictureUrl}
          alt={`${participantName} profile`}
          className="size-full object-cover"
        />
      )}
      <AvatarFallback
        className={cn("bg-primary-800 font-semibold text-primary-50", {
          "text-xs": size === "sm",
          "text-2xl": size !== "sm",
        })}
      >
        {participantInitials}
      </AvatarFallback>
    </Avatar>
  );
}
