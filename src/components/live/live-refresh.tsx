"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { tournamentTopic, type LiveKind } from "@/lib/realtime/topics";
import { useLiveChannel } from "@/lib/realtime/use-live-channel";
import styles from "./live-refresh.module.css";

const settleMs = 1_500;
const fallbackMs = 30_000;

// Re-renders a server page when the tournament changes. A burst of changes
// becomes one refresh, a hidden tab catches up when shown again, and without
// a live connection the page still refreshes every 30 seconds.
export function LiveRefresh({
  tournamentId,
  kinds,
}: {
  tournamentId: string;
  kinds?: LiveKind[];
}) {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  const missed = useRef(false);

  const status = useLiveChannel(tournamentTopic(tournamentId), (message) => {
    if (message.kind !== "resync" && kinds && !kinds.includes(message.kind)) {
      return;
    }
    if (document.visibilityState !== "visible") {
      missed.current = true;
      return;
    }
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, settleMs);
  });

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && missed.current) {
        missed.current = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [router]);

  useEffect(() => {
    if (status === "live") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, fallbackMs);
    return () => window.clearInterval(interval);
  }, [status, router]);

  // A div, not a span: page headers style their spans as subtitles.
  return (
    <div
      className={styles.badge}
      data-status={status}
      title={
        status === "live"
          ? "This page updates as soon as anything changes."
          : "Live updates are reconnecting. The page refreshes every 30 seconds meanwhile."
      }
    >
      {status === "live"
        ? "Live"
        : status === "connecting"
          ? "Connecting"
          : "Reconnecting"}
    </div>
  );
}
