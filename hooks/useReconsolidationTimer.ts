"use client";

// ============================================================================
// useReconsolidationTimer — 5-hour reconsolidation window (T_window ≤ 5h),
// 3 mandatory 30-second recall prompts, browser notifications.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours
export const REQUIRED_REPS = 3;
export const RECALL_DURATION_S = 30;

/**
 * Recall prompts land at 25%, 50%, and 85% of the window — spaced so the
 * final rep still precedes synaptic relocking with margin.
 */
export const PROMPT_OFFSETS_MS = [
  0.25 * WINDOW_MS,
  0.5 * WINDOW_MS,
  0.85 * WINDOW_MS,
] as const;

export interface RecallPromptState {
  ordinal: 1 | 2 | 3;
  scheduledAt: Date;
  completedAt: Date | null;
  /** Due when now >= scheduledAt and not completed. */
  isDue: boolean;
}

export interface UseReconsolidationTimerReturn {
  /** Milliseconds remaining in the window (0 when closed). */
  remainingMs: number;
  /** hh:mm:ss formatted remaining time. */
  remainingLabel: string;
  /** 0..1 fraction of the window elapsed. */
  windowProgress: number;
  isWindowOpen: boolean;
  isWindowClosed: boolean;
  prompts: RecallPromptState[];
  repsCompleted: number;
  repsRequired: number;
  /** The lowest-ordinal due prompt, if any. */
  activePrompt: RecallPromptState | null;
  /** Seconds remaining in the running 30s recall rep, or null if none running. */
  recallSecondsLeft: number | null;
  startRecallRep: () => void;
  /** True once all mandatory reps completed inside the window. */
  allRepsComplete: boolean;
  requestNotificationPermission: () => Promise<void>;
}

interface UseReconsolidationTimerOptions {
  /** When the juxtaposition opened the window. */
  windowOpenedAt: Date | null;
  /** Ordinals (1-3) already completed, e.g. loaded from the DB. */
  completedOrdinals?: number[];
  /** Fired when a 30s rep finishes; persist to recall_prompts here. */
  onRepComplete?: (ordinal: 1 | 2 | 3) => void;
  /** Fired once when the window expires. */
  onWindowClosed?: () => void;
}

function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function useReconsolidationTimer({
  windowOpenedAt,
  completedOrdinals = [],
  onRepComplete,
  onWindowClosed,
}: UseReconsolidationTimerOptions): UseReconsolidationTimerReturn {
  const [now, setNow] = useState<number>(() => Date.now());
  const [completed, setCompleted] = useState<Set<number>>(
    () => new Set(completedOrdinals)
  );
  const [recallSecondsLeft, setRecallSecondsLeft] = useState<number | null>(null);

  const notifiedOrdinalsRef = useRef<Set<number>>(new Set());
  const windowClosedFiredRef = useRef(false);
  const recallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRepCompleteRef = useRef(onRepComplete);
  const onWindowClosedRef = useRef(onWindowClosed);
  onRepCompleteRef.current = onRepComplete;
  onWindowClosedRef.current = onWindowClosed;

  const openedMs = windowOpenedAt?.getTime() ?? null;
  const closesMs = openedMs !== null ? openedMs + WINDOW_MS : null;
  const remainingMs =
    closesMs !== null ? Math.max(0, closesMs - now) : 0;
  const isWindowOpen = openedMs !== null && remainingMs > 0;
  const isWindowClosed = openedMs !== null && remainingMs <= 0;

  // 1 Hz clock while the window is open.
  useEffect(() => {
    if (openedMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openedMs]);

  const prompts: RecallPromptState[] = useMemo(() => {
    if (openedMs === null) return [];
    return PROMPT_OFFSETS_MS.map((offset, i) => {
      const ordinal = (i + 1) as 1 | 2 | 3;
      const scheduledAt = new Date(openedMs + offset);
      const done = completed.has(ordinal);
      return {
        ordinal,
        scheduledAt,
        completedAt: done ? new Date() : null,
        isDue: !done && now >= scheduledAt.getTime() && remainingMs > 0,
      };
    });
  }, [openedMs, completed, now, remainingMs]);

  const activePrompt = prompts.find((p) => p.isDue) ?? null;

  // Browser notification when a prompt comes due.
  useEffect(() => {
    if (!activePrompt) return;
    if (notifiedOrdinalsRef.current.has(activePrompt.ordinal)) return;
    notifiedOrdinalsRef.current.add(activePrompt.ordinal);

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Reconsolidation recall due", {
        body: `Rep ${activePrompt.ordinal} of ${REQUIRED_REPS}: hold the NEW model in mind for 30 seconds.`,
        tag: `recall-${activePrompt.ordinal}`,
      });
    }
  }, [activePrompt]);

  // Fire onWindowClosed exactly once.
  useEffect(() => {
    if (isWindowClosed && !windowClosedFiredRef.current) {
      windowClosedFiredRef.current = true;
      onWindowClosedRef.current?.();
    }
  }, [isWindowClosed]);

  const startRecallRep = useCallback(() => {
    if (!activePrompt || recallTimerRef.current) return;
    const ordinal = activePrompt.ordinal;
    setRecallSecondsLeft(RECALL_DURATION_S);

    recallTimerRef.current = setInterval(() => {
      setRecallSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (recallTimerRef.current) {
            clearInterval(recallTimerRef.current);
            recallTimerRef.current = null;
          }
          setCompleted((c) => new Set(c).add(ordinal));
          onRepCompleteRef.current?.(ordinal);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [activePrompt]);

  useEffect(
    () => () => {
      if (recallTimerRef.current) clearInterval(recallTimerRef.current);
    },
    []
  );

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  return {
    remainingMs,
    remainingLabel: formatHMS(remainingMs),
    windowProgress:
      openedMs !== null ? Math.min(1, (now - openedMs) / WINDOW_MS) : 0,
    isWindowOpen,
    isWindowClosed,
    prompts,
    repsCompleted: completed.size,
    repsRequired: REQUIRED_REPS,
    activePrompt,
    recallSecondsLeft,
    startRecallRep,
    allRepsComplete: completed.size >= REQUIRED_REPS,
    requestNotificationPermission,
  };
}
