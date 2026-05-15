import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

import { getActiveMentionQuery, getUserDisplayName } from "./courseChatUtils";

import type { KeyboardEvent } from "react";
import type { CourseChatUser } from "~/api/queries/course-chat/courseChatTypes";

type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  users: CourseChatUser[];
  placeholder: string;
  maxLength: number;
  className?: string;
};

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  ({ value, onChange, onKeyDown, users, placeholder, maxLength, className }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [isPickerDismissed, setIsPickerDismissed] = useState(false);
    const mentionQuery = getActiveMentionQuery(value);
    const matchingUsers = useMemo(() => {
      if (mentionQuery === null || isPickerDismissed) return [];

      const normalizedQuery = mentionQuery.toLowerCase();

      return users
        .filter((user) => getUserDisplayName(user).toLowerCase().includes(normalizedQuery))
        .slice(0, 6);
    }, [isPickerDismissed, mentionQuery, users]);

    useEffect(() => {
      setHighlightedIndex(0);
      setIsPickerDismissed(false);
    }, [mentionQuery]);

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const styles = window.getComputedStyle(textarea);
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const verticalPadding =
        Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const maxHeight = lineHeight * 4 + verticalPadding;

      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [value]);

    const insertMention = (user: CourseChatUser) => {
      const mention = `@${getUserDisplayName(user)} `;
      const nextValue = value.replace(/(^|\s)@([^\s@]*)$/, `$1${mention}`);
      onChange(nextValue);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (matchingUsers.length) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setHighlightedIndex((current) => (current + 1) % matchingUsers.length);
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setHighlightedIndex(
            (current) => (current - 1 + matchingUsers.length) % matchingUsers.length,
          );
          return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          insertMention(matchingUsers[highlightedIndex]);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setIsPickerDismissed(true);
          return;
        }
      }

      onKeyDown?.(event);
    };

    return (
      <div className="relative">
        <Textarea
          ref={(node) => {
            textareaRef.current = node;

            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={1}
          className={className}
        />
        {matchingUsers.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-2 w-72 rounded-xl border border-neutral-200 bg-background p-2 shadow-lg">
            {matchingUsers.map((user, index) => {
              const userName = getUserDisplayName(user);

              return (
                <button
                  key={user.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-neutral-50",
                    { "bg-neutral-50": index === highlightedIndex },
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(user);
                  }}
                >
                  <UserAvatar
                    className="size-8"
                    userName={userName}
                    profilePictureUrl={user.avatarReference}
                  />
                  <span className="body-sm-md truncate text-neutral-950">{userName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
MentionTextarea.displayName = "MentionTextarea";
