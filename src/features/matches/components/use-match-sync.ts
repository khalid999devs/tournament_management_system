"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ScoreCommand } from "../domain/commands";
import type { MatchState } from "../server/match-queries";

export type OutboxItem = {
  clientEventId: string;
  deviceTime: string;
  command: ScoreCommand;
  label: string;
  status: "queued" | "sending" | "retrying" | "failed";
  attempts: number;
  message?: string;
  code?: string;
  nextAttemptAt?: number;
};

type ServerReply = {
  ok: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
  state?: MatchState | null;
  unchanged?: boolean;
};

const requestTimeoutMs = 15_000;
const backoffMs = [1_000, 2_000, 4_000, 8_000, 15_000];
const pollLiveMs = 6_000;
const pollIdleMs = 30_000;

// ---------------------------------------------------------------------------
// Outbox store: persisted in localStorage so queued actions survive a reload,
// a crash or a flat battery, and shared with other tabs through the storage
// event.

type Store = { items: OutboxItem[]; listeners: Set<() => void> };

const stores = new Map<string, Store>();
const emptyOutbox: OutboxItem[] = [];

function readOutbox(key: string): OutboxItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    const items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    // Anything that was mid-flight when the page closed is simply resent;
    // its event id makes the resend harmless if it had already landed.
    return items.map((item) =>
      item.status === "sending" ? { ...item, status: "retrying" } : item,
    );
  } catch {
    return [];
  }
}

function writeOutbox(key: string, items: OutboxItem[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage can be full or blocked; the in-memory queue still works.
  }
}

function getStore(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = { items: readOutbox(key), listeners: new Set() };
    stores.set(key, store);
  }
  return store;
}

function updateOutbox(
  key: string,
  change: (items: OutboxItem[]) => OutboxItem[],
) {
  const store = getStore(key);
  store.items = change(store.items);
  writeOutbox(key, store.items);
  store.listeners.forEach((listener) => listener());
}

function patchItem(
  key: string,
  clientEventId: string,
  patch: Partial<OutboxItem>,
) {
  updateOutbox(key, (items) =>
    items.map((item) =>
      item.clientEventId === clientEventId ? { ...item, ...patch } : item,
    ),
  );
}

function subscribeOutbox(key: string, listener: () => void) {
  const store = getStore(key);
  store.listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    store.items = readOutbox(key);
    store.listeners.forEach((notify) => notify());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    store.listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

async function request(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: ServerReply | null }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = (await response
      .json()
      .catch(() => null)) as ServerReply | null;
    return { status: response.status, body };
  } finally {
    window.clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------

// Keeps one match's score screen in step with the server. Every action goes
// through the outbox and is sent strictly in order; a failure that needs a
// person pauses the queue instead of skipping ahead.
export function useMatchSync(initial: MatchState, actorId: string) {
  const endpoint = `/staff/api/matches/${initial.id}`;
  const key = `ndcak.outbox.${actorId}.${initial.id}`;

  const [state, setState] = useState(initial);
  const [seenInitial, setSeenInitial] = useState(initial);
  const [signedOut, setSignedOut] = useState(false);
  const [leader, setLeader] = useState(true);
  const [wakeups, setWakeups] = useState(0);
  const sending = useRef(false);
  const releaseLock = useRef<(() => void) | null>(null);

  // A server-rendered refresh (after an admin action) can bring newer state.
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    if (initial.version >= state.version) setState(initial);
  }

  const outbox = useSyncExternalStore(
    useCallback(
      (listener: () => void) => subscribeOutbox(key, listener),
      [key],
    ),
    () => getStore(key).items,
    () => emptyOutbox,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const adopt = useCallback((next: MatchState | null | undefined) => {
    if (!next) return;
    setState((current) => (next.version >= current.version ? next : current));
  }, []);

  // Only one tab per operator and match sends, so two tabs never race the
  // same queue. Another tab can take over explicitly.
  const acquire = useCallback(
    (steal: boolean) => {
      if (!("locks" in navigator)) return;
      releaseLock.current?.();
      navigator.locks
        .request(
          key,
          steal ? { steal: true } : { ifAvailable: true },
          (lock) => {
            if (!lock) {
              setLeader(false);
              return;
            }
            setLeader(true);
            return new Promise<void>((resolve) => {
              releaseLock.current = resolve;
            });
          },
        )
        .catch(() => setLeader(false));
    },
    [key],
  );

  useEffect(() => {
    acquire(false);
    return () => releaseLock.current?.();
  }, [acquire]);

  // Coming back online retries waiting actions straight away.
  useEffect(() => {
    if (!online) return;
    updateOutbox(key, (items) =>
      items.map((item) =>
        item.status === "retrying" &&
        item.nextAttemptAt !== Number.MAX_SAFE_INTEGER
          ? { ...item, nextAttemptAt: 0 }
          : item,
      ),
    );
  }, [online, key]);

  const send = useCallback(
    async (item: OutboxItem) => {
      sending.current = true;
      patchItem(key, item.clientEventId, { status: "sending" });

      let status = 0;
      let body: ServerReply | null = null;
      try {
        ({ status, body } = await request(endpoint, {
          method: "POST",
          body: JSON.stringify({
            clientEventId: item.clientEventId,
            deviceTime: item.deviceTime,
            command: item.command,
          }),
        }));
      } catch {
        status = 0;
      }
      sending.current = false;

      if (status === 200 && body?.ok) {
        adopt(body.state);
        updateOutbox(key, (items) =>
          items.filter((entry) => entry.clientEventId !== item.clientEventId),
        );
        return;
      }

      if (status === 401) {
        setSignedOut(true);
        // Held until the operator signs in again and presses "Send now".
        patchItem(key, item.clientEventId, {
          status: "retrying",
          nextAttemptAt: Number.MAX_SAFE_INTEGER,
          message: "Signed out. Sign in again, then send.",
        });
        return;
      }

      const retryable =
        status === 0 ||
        status >= 500 ||
        status === 429 ||
        body?.retryable === true;
      if (retryable) {
        const attempts = item.attempts + 1;
        const delay = backoffMs[Math.min(attempts - 1, backoffMs.length - 1)];
        patchItem(key, item.clientEventId, {
          status: "retrying",
          attempts,
          nextAttemptAt: Date.now() + delay,
          message:
            status === 0
              ? "No connection. Retrying…"
              : "Server busy. Retrying…",
        });
        window.setTimeout(() => setWakeups((value) => value + 1), delay + 50);
        return;
      }

      adopt(body?.state);
      patchItem(key, item.clientEventId, {
        status: "failed",
        code: body?.code ?? "ERROR",
        message: body?.message ?? "This action was not accepted.",
      });
    },
    [endpoint, key, adopt],
  );

  // Send the head of the queue, one at a time.
  useEffect(() => {
    if (!leader || sending.current) return;
    const head = outbox[0];
    if (!head || head.status === "failed" || head.status === "sending") return;
    if (head.nextAttemptAt && head.nextAttemptAt > Date.now()) return;
    const timer = window.setTimeout(() => {
      if (!sending.current) void send(head);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [outbox, leader, send, wakeups]);

  const refresh = useCallback(async () => {
    try {
      const { status, body } = await request(
        `${endpoint}?since=${state.version}`,
      );
      if (status === 401) setSignedOut(true);
      if (status === 200) setSignedOut(false);
      if (status === 200 && body?.ok && !body.unchanged) adopt(body.state);
    } catch {
      // The next poll tries again.
    }
  }, [endpoint, state.version, adopt]);

  // Until realtime lands, poll cheaply: the server answers "unchanged"
  // unless the version moved.
  useEffect(() => {
    const live = ["SCHEDULED", "IN_PROGRESS"].includes(state.status);
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible" && !sending.current)
          void refresh();
      },
      live ? pollLiveMs : pollIdleMs,
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.status, refresh]);

  const enqueue = useCallback(
    (command: ScoreCommand, label: string) => {
      updateOutbox(key, (items) => [
        ...items,
        {
          clientEventId: crypto.randomUUID(),
          deviceTime: new Date().toISOString(),
          command,
          label,
          status: "queued",
          attempts: 0,
        },
      ]);
    },
    [key],
  );

  const discard = useCallback(
    (clientEventId: string) =>
      updateOutbox(key, (items) =>
        items.filter((item) => item.clientEventId !== clientEventId),
      ),
    [key],
  );

  const retryNow = useCallback(
    (clientEventId: string) => {
      setSignedOut(false);
      patchItem(key, clientEventId, { status: "retrying", nextAttemptAt: 0 });
    },
    [key],
  );

  return {
    state,
    outbox,
    online,
    signedOut,
    leader,
    takeOver: () => acquire(true),
    enqueue,
    discard,
    retryNow,
    refresh,
  };
}
