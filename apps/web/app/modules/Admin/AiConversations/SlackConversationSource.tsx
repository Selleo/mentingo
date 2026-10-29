export function SlackConversationSource() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-neutral-600">
      <svg className="size-4" viewBox="0 0 24 24" role="img" aria-label="Slack">
        <g fill="#36c5f0">
          <rect x="2" y="8" width="9" height="4" rx="2" />
          <path d="M7 5a2 2 0 1 0-2 2h2Z" />
        </g>
        <g fill="#2eb67d">
          <rect x="12" y="2" width="4" height="9" rx="2" />
          <path d="M19 7a2 2 0 1 0-2-2v2Z" />
        </g>
        <g fill="#ecb22e">
          <rect x="13" y="12" width="9" height="4" rx="2" />
          <path d="M17 19a2 2 0 1 0 2-2h-2Z" />
        </g>
        <g fill="#e01e5a">
          <rect x="8" y="13" width="4" height="9" rx="2" />
          <path d="M5 17a2 2 0 1 0 2 2v-2Z" />
        </g>
      </svg>
      <span aria-hidden="true">Slack</span>
    </span>
  );
}
