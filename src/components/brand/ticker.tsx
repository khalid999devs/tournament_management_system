"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";

// Moving text needs a way to stop it (WCAG 2.2.2); it also pauses on hover
// and keyboard focus, and stays still for people who prefer reduced motion.
export function Ticker({ items }: { items: string[] }) {
  const [paused, setPaused] = useState(false);

  return (
    <div
      className={paused ? "ticker paused" : "ticker"}
      role="region"
      aria-label="Event highlights"
    >
      <div className="ticker-track">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {items.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ))}
      </div>
      <button
        className="ticker-toggle"
        type="button"
        aria-label={paused ? "Play highlights" : "Pause highlights"}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? (
          <Play size={14} aria-hidden="true" />
        ) : (
          <Pause size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
