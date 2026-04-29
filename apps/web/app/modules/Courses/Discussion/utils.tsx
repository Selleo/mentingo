import { Fragment } from "react";

const URL_REGEX = /(https?:\/\/[^\s<]+)/gi;

export function renderCommentContent(content: string) {
  return content.split(/\r?\n/).map((line, lineIdx, lines) => {
    const parts: Array<string | { url: string; key: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    URL_REGEX.lastIndex = 0;
    while ((match = URL_REGEX.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push({ url: match[0], key: `${lineIdx}-${match.index}` });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <Fragment key={lineIdx}>
        {parts.map((part, idx) =>
          typeof part === "string" ? (
            <Fragment key={idx}>{part}</Fragment>
          ) : (
            <a
              key={idx}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-700 underline break-all"
            >
              {part.url}
            </a>
          ),
        )}
        {lineIdx < lines.length - 1 && <br />}
      </Fragment>
    );
  });
}
