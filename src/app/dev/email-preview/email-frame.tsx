"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EmailFrameProps = {
  title: string;
  html: string;
  className: string;
};

export function EmailFrame({ title, html, className }: EmailFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1);

  const measure = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document) return;

    setHeight(
      Math.ceil(
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
        ),
      ),
    );
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    frame?.addEventListener("load", measure);
    measure();

    return () => frame?.removeEventListener("load", measure);
  }, [html, measure]);

  return (
    <iframe
      ref={frameRef}
      title={title}
      sandbox="allow-same-origin"
      srcDoc={html}
      className={className}
      style={{ height }}
      onLoad={measure}
    />
  );
}
