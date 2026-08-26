import { escape } from "lodash-es";

const INLINE_CODE_REGEX = /(?<!`)`([^`\n]+)`(?!`)/g;
const FENCED_CODE_BLOCK_REGEX = /(^|\n)([ \t]*)(```|~~~)([^\n]*)\n([\s\S]*?)\n\2\3[ \t]*(?=\n|$)/g;

const sanitizeLanguage = (language: string) =>
  (language.trim().split(/\s+/u)[0] ?? "").replace(/[^a-z\d_-]/giu, "");

export const normalizeMarkdownCode = (content: string) => {
  const withFencedCodeBlocks = content.replace(
    FENCED_CODE_BLOCK_REGEX,
    (_match, prefix: string, indentation: string, fence: string, info: string, code: string) => {
      const language = sanitizeLanguage(info);
      const className = language ? ` class="language-${language}"` : "";

      return `${prefix}${indentation}<pre><code${className}>${escape(code)}</code></pre>`;
    },
  );

  return withFencedCodeBlocks.replace(INLINE_CODE_REGEX, (_match, code: string) => {
    return `<code>${escape(code)}</code>`;
  });
};
