"use client";

import { useEffect, useState } from "react";

const messages = {
  initial: "High-quality room renders typically take 3-5 minutes.",
  mid: "Still refining the image. Higher-quality renders can take a little longer.",
  long: "This is taking longer than usual. You can keep this page open while we finish."
};

export function RenderExpectationNote({ className }: { className?: string }) {
  const [message, setMessage] = useState(messages.initial);

  useEffect(() => {
    const midTimer = window.setTimeout(() => setMessage(messages.mid), 3 * 60 * 1000);
    const longTimer = window.setTimeout(() => setMessage(messages.long), 5 * 60 * 1000);

    return () => {
      window.clearTimeout(midTimer);
      window.clearTimeout(longTimer);
    };
  }, []);

  return (
    <p className={`font-body text-body-s text-ink-secondary ${className ?? ""}`}>
      {message}
    </p>
  );
}
