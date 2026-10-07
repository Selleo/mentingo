import { useEffect, useRef, useState } from "react";

interface SimulationEmailPreviewProps {
  html: string;
  subject: string;
}

export function SimulationEmailPreview({ html, subject }: SimulationEmailPreviewProps) {
  const [height, setHeight] = useState(1);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  function resizeToEmailContent(iframe: HTMLIFrameElement) {
    resizeObserverRef.current?.disconnect();

    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;

    if (!frameDocument?.body || !frameWindow) return;

    const { body } = frameDocument;

    const updateHeight = () => {
      const styles = frameWindow.getComputedStyle(body);
      const verticalMargins =
        (Number.parseFloat(styles.marginTop) || 0) + (Number.parseFloat(styles.marginBottom) || 0);

      setHeight(
        Math.ceil(
          Math.max(body.scrollHeight, body.getBoundingClientRect().height) + verticalMargins,
        ),
      );
    };

    resizeObserverRef.current = new ResizeObserver(updateHeight);
    resizeObserverRef.current.observe(body);
    updateHeight();
  }

  return (
    <iframe
      srcDoc={html}
      sandbox="allow-same-origin"
      title={subject}
      onLoad={(event) => resizeToEmailContent(event.currentTarget)}
      style={{ height }}
      className="block w-full border-0 bg-white"
    />
  );
}
