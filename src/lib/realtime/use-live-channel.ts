"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { liveEvent, type LiveMessage } from "./topics";

export type LiveStatus = "connecting" | "live" | "offline";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

// Listens on one private Realtime channel. Every reconnect after the first
// delivers { kind: "resync" }, because messages sent while the connection
// was down are not replayed; the screen fetches fresh data instead.
export function useLiveChannel(
  topic: string | null,
  onMessage: (message: LiveMessage) => void,
): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const deliver = useEffectEvent(onMessage);

  useEffect(() => {
    if (!topic || !configured) return;

    const supabase = createClient();
    const channel = supabase.channel(topic, { config: { private: true } });
    let joinedBefore = false;
    let active = true;

    channel.on("broadcast", { event: liveEvent }, ({ payload }) => {
      deliver((payload ?? { kind: "resync" }) as LiveMessage);
    });

    // Private channels check the signed-in staff member's token on join.
    void supabase.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        channel.subscribe((state) => {
          if (state === "SUBSCRIBED") {
            setStatus("live");
            if (joinedBefore) deliver({ kind: "resync" });
            joinedBefore = true;
          } else {
            setStatus("offline");
          }
        });
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [topic]);

  return configured && topic ? status : "offline";
}
