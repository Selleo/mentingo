import { AI_CONVERSATION_SOURCES } from "@repo/shared";
import { match } from "ts-pattern";

import { Icon } from "~/components/Icon";

export function isExternalConversationSource(source?: string | null) {
  return Boolean(source && source !== AI_CONVERSATION_SOURCES.MENTINGO);
}

export function ExternalConversationSource({ source }: { source?: string | null }) {
  const platform = match(source)
    .with(AI_CONVERSATION_SOURCES.SLACK, () => ({
      label: "Slack",
      icon: <Icon name="Slack" className="size-4" role="img" aria-label="Slack" />,
    }))
    .with(AI_CONVERSATION_SOURCES.DISCORD, () => ({
      label: "Discord",
      icon: (
        <svg className="size-4" viewBox="0 0 24 24" role="img" aria-label="Discord">
          <path
            fill="#5865f2"
            d="M19.6 5.3a18 18 0 0 0-4.4-1.4l-.6 1.2a16.3 16.3 0 0 0-5.2 0l-.6-1.2a18 18 0 0 0-4.4 1.4C1.6 9.4.8 13.4 1.2 17.4a18 18 0 0 0 5.4 2.7l1.1-1.8-1.7-.8.4-.3a12.5 12.5 0 0 0 11.2 0l.4.3-1.7.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.6-.8-8.5-3.2-12.1Z"
          />
          <ellipse fill="white" cx="8" cy="12.5" rx="1.6" ry="1.9" />
          <ellipse fill="white" cx="16" cy="12.5" rx="1.6" ry="1.9" />
        </svg>
      ),
    }))
    .with(AI_CONVERSATION_SOURCES.WHATSAPP, () => ({
      label: "WhatsApp",
      icon: (
        <svg className="size-4" viewBox="0 0 24 24" role="img" aria-label="WhatsApp">
          <path fill="#25d366" d="M12 1a11 11 0 0 0-9.5 16.5L1 23l5.7-1.5A11 11 0 1 0 12 1Z" />
          <path
            fill="white"
            d="M8.3 6.3c-.3-.6-.6-.6-.9-.6h-.8c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.1s1.4 3.5 1.6 3.8c.2.2 2.7 4.1 6.5 5.6.9.4 1.6.6 2.2.7.9.3 1.7.2 2.4.2.7-.2 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.2-.3-.3-.7-.5l-2.5-1.2c-.3-.1-.6-.2-.8.2l-1.1 1.3c-.2.2-.4.2-.8.1-1-.5-1.9-1-2.6-1.7-.6-.6-1.2-1.3-1.7-2.1-.2-.4 0-.6.1-.7l.6-.7.4-.6c.1-.2 0-.5 0-.7l-1.3-3.1Z"
            transform="translate(2.8 2.8) scale(.72)"
          />
        </svg>
      ),
    }))
    .otherwise(() => null);

  if (!platform) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-neutral-600">
      {platform.icon}
      <span aria-hidden="true">{platform.label}</span>
    </span>
  );
}
