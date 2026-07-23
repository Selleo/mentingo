import mailyStyleContent from "@maily-to/core/style.css?raw";
import { useEffect } from "react";

const MAILY_STYLE_TAG_ID = "maily-editor-styles";

const unwrapUtilitiesLayer = (css: string): string => {
  const match = css.match(/@layer\s+utilities\s*\{/);
  if (!match || match.index === undefined) return css;
  const openStart = match.index;
  const bodyStart = openStart + match[0].length;
  let depth = 1;
  let i = bodyStart;
  while (i < css.length && depth > 0) {
    const c = css[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    i++;
  }
  if (depth !== 0) return css;
  return css.slice(0, openStart) + css.slice(bodyStart, i - 1) + css.slice(i);
};
const MAILY_OVERRIDES = `
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url('https://rsms.me/inter/font-files/Inter-Regular.woff2?v=3.19') format('woff2');
}

#mly-editor {
  margin-top: 1rem;
  margin-left: 0.5rem;
}

#mly-editor .ProseMirror {
  font-family: 'Inter', sans-serif;
}
#mly-editor .ProseMirror h1 { font-size: 36px; line-height: 40px; font-weight: 800; }
#mly-editor .ProseMirror h2 { font-size: 30px; line-height: 36px; font-weight: 700; }
#mly-editor .ProseMirror h3 { font-size: 24px; line-height: 38px; font-weight: 600; }
#mly-editor .ProseMirror p,
#mly-editor .ProseMirror li { font-size: 15px; line-height: 26.25px; color: #374151; }
#mly-editor .ProseMirror a[data-type="button"] {
  font-size: 14px;
  font-weight: 500;
}
#mly-editor .ProseMirror [data-type="footer"] {
  font-size: 14px;
  line-height: 24px;
  color: #64748B;
}

#mly-editor .ProseMirror .is-empty::before {
  content: attr(data-placeholder);
  float: left;
  color: #94a3b8;
  pointer-events: none;
  height: 0;
  white-space: pre-wrap;
}

#mly-editor .ProseMirror [data-fallback-text="true"] button {
  opacity: 0.4;
}

.hide-number-controls::-webkit-outer-spin-button,
.hide-number-controls::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.hide-number-controls[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

button:has(> svg.lucide-eye) {
  display: none !important;
}
div.mly\\:w-px:has(+ button > svg.lucide-eye) {
  display: none !important;
}
`;

export const useMailyEditorStyles = (): void => {
  useEffect(() => {
    if (document.getElementById(MAILY_STYLE_TAG_ID)) return;
    const style = document.createElement("style");
    style.id = MAILY_STYLE_TAG_ID;
    style.textContent = unwrapUtilitiesLayer(mailyStyleContent) + MAILY_OVERRIDES;
    document.head.appendChild(style);
  }, []);
};
