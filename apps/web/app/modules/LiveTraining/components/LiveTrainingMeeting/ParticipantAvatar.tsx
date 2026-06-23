import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

type ParticipantAvatarProps = {
  participantName: string;
  participantInitials: string;
  profilePictureUrl?: string | null;
  size: "sm" | "lg" | "fullscreen";
  accentColor?: string;
};

export function ParticipantAvatar({
  participantName,
  participantInitials,
  profilePictureUrl,
  size,
  accentColor = "var(--primary-700)",
}: ParticipantAvatarProps) {
  return (
    <Avatar
      className={cn("shrink-0 ring-1 ring-white/20", {
        "size-7": size === "sm",
        "size-20": size === "lg",
        "size-32": size === "fullscreen",
      })}
      style={{ backgroundColor: accentColor }}
    >
      {profilePictureUrl && (
        <AvatarImage
          src={profilePictureUrl}
          alt={`${participantName} profile`}
          className="size-full object-cover"
        />
      )}
      <AvatarFallback
        className={cn("font-semibold text-white", {
          "text-xs": size === "sm",
          "text-2xl": size !== "sm",
        })}
        style={{ backgroundColor: accentColor }}
      >
        {participantInitials}
      </AvatarFallback>
    </Avatar>
  );
}
