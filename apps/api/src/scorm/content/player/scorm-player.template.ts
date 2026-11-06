import { SCORM_CONTENT_PATHS, SCORM_PLAYER_ATTRIBUTES } from "@repo/shared";

export function renderScormPlayer(token: string) {
  const prefix = `${SCORM_CONTENT_PATHS.PREFIX}${token}`;
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="referrer" content="${SCORM_PLAYER_ATTRIBUTES.REFERRER_POLICY}">
        <style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block;overflow:hidden}</style>
        <script src="${prefix}/${SCORM_CONTENT_PATHS.RUNTIME_SCRIPT}"></script>
        <script defer src="${prefix}/${SCORM_CONTENT_PATHS.BOOTSTRAP_SCRIPT}"></script>
      </head>
      <body></body>
    </html>`;
}
