"use client";

// ============================================================================
// useRSVPReader — requestAnimationFrame display loop, ORP math, WPM control,
// and live metric tallying for an RSVP sprint.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampWPM,
  frameDurationMs,
  tokenizeForRSVP,
  type RSVPToken,
} from "@/lib/rsvp";
import type { RSVPMetrics } from "@/lib/types";

export interface UseRSVPReaderOptions {
  initialWPM?: number;
  chunkSize?: 1 | 2 | 3;
  /** Resume position: start playback at the frame containing this word. */
  startWordIndex?: number;
  onComplete?: (metrics: RSVPMetrics) => void;
}

export interface UseRSVPReaderReturn {
  /** Current frame, or null before start / after completion. */
  token: RSVPToken | null;
  tokenIndex: number;
  totalTokens: number;
  /** 0..1 progress through the text. */
  progress: number;
  isPlaying: boolean;
  isComplete: boolean;
  wpm: number;
  chunkSize: 1 | 2 | 3;
  metrics: RSVPMetrics;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  /** Jump backward/forward by N frames (negative = rewind). */
  skip: (frames: number) => void;
  setWPM: (wpm: number) => void;
  setChunkSize: (size: 1 | 2 | 3) => void;
}

export function useRSVPReader(
  text: string,
  {
    initialWPM = 300,
    chunkSize: initialChunkSize = 1,
    startWordIndex = 0,
    onComplete,
  }: UseRSVPReaderOptions = {}
): UseRSVPReaderReturn {
  const [wpm, setWPMState] = useState(() => clampWPM(initialWPM));
  const [chunkSize, setChunkSizeState] = useState<1 | 2 | 3>(initialChunkSize);
  const [tokenIndex, setTokenIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [metrics, setMetrics] = useState<RSVPMetrics>({
    wordsConsumed: 0,
    activeMs: 0,
    effectiveWPM: 0,
    wpmHistory: [],
    peakWPM: clampWPM(initialWPM),
  });

  const tokens = useMemo(
    () => tokenizeForRSVP(text, chunkSize),
    [text, chunkSize]
  );

  // Mutable loop state lives in refs so the rAF callback never goes stale.
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const frameElapsedRef = useRef(0);   // ms accumulated on the current frame
  const activeMsRef = useRef(0);       // total active (playing) ms this sprint
  const wordsConsumedRef = useRef(0);
  const indexRef = useRef(0);
  const wpmRef = useRef(wpm);
  const playingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const buildMetrics = useCallback(
    (prev: RSVPMetrics): RSVPMetrics => {
      const activeMs = activeMsRef.current;
      const wordsConsumed = wordsConsumedRef.current;
      return {
        ...prev,
        wordsConsumed,
        activeMs,
        effectiveWPM:
          activeMs > 0 ? Math.round((wordsConsumed / activeMs) * 60_000) : 0,
      };
    },
    []
  );

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = null;
  }, []);

  const tick = useCallback(
    (now: number) => {
      if (!playingRef.current) return;

      if (lastTickRef.current === null) {
        lastTickRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Clamp tab-switch gaps so a background tab doesn't fast-forward.
      const delta = Math.min(now - lastTickRef.current, 250);
      lastTickRef.current = now;
      frameElapsedRef.current += delta;
      activeMsRef.current += delta;

      const current = tokens[indexRef.current];
      if (!current) return;

      const duration = frameDurationMs(current, wpmRef.current);

      if (frameElapsedRef.current >= duration) {
        // Carry the overshoot into the next frame for accurate pacing.
        frameElapsedRef.current -= duration;
        wordsConsumedRef.current += current.wordCount;

        if (indexRef.current + 1 >= tokens.length) {
          playingRef.current = false;
          setIsPlaying(false);
          setIsComplete(true);
          stopLoop();
          setMetrics((prev) => {
            const final = buildMetrics(prev);
            onCompleteRef.current?.(final);
            return final;
          });
          return;
        }

        indexRef.current += 1;
        setTokenIndex(indexRef.current);
        setMetrics(buildMetrics);
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [tokens, buildMetrics, stopLoop]
  );

  const play = useCallback(() => {
    if (isComplete || tokens.length === 0) return;
    playingRef.current = true;
    setIsPlaying(true);
    lastTickRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [isComplete, tokens.length, tick]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    stopLoop();
    setMetrics(buildMetrics);
  }, [stopLoop, buildMetrics]);

  const toggle = useCallback(() => {
    if (playingRef.current) {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  const restart = useCallback(() => {
    pause();
    indexRef.current = 0;
    frameElapsedRef.current = 0;
    activeMsRef.current = 0;
    wordsConsumedRef.current = 0;
    setTokenIndex(0);
    setIsComplete(false);
    setMetrics({
      wordsConsumed: 0,
      activeMs: 0,
      effectiveWPM: 0,
      wpmHistory: [{ atMs: 0, wpm: wpmRef.current }],
      peakWPM: wpmRef.current,
    });
  }, [pause]);

  const skip = useCallback(
    (frames: number) => {
      const next = Math.min(
        Math.max(indexRef.current + frames, 0),
        Math.max(tokens.length - 1, 0)
      );
      indexRef.current = next;
      frameElapsedRef.current = 0;
      setTokenIndex(next);
      if (isComplete && next < tokens.length - 1) setIsComplete(false);
    },
    [tokens.length, isComplete]
  );

  const setWPM = useCallback((next: number) => {
    const clamped = clampWPM(next);
    wpmRef.current = clamped;
    setWPMState(clamped);
    setMetrics((prev) => ({
      ...prev,
      peakWPM: Math.max(prev.peakWPM, clamped),
      wpmHistory: [
        ...prev.wpmHistory,
        { atMs: activeMsRef.current, wpm: clamped },
      ],
    }));
  }, []);

  const setChunkSize = useCallback(
    (size: 1 | 2 | 3) => {
      pause();
      setChunkSizeState(size);
      indexRef.current = 0;
      frameElapsedRef.current = 0;
      setTokenIndex(0);
      setIsComplete(false);
    },
    [pause]
  );

  // Reset when the source text changes; clean up the loop on unmount.
  // Resume: start at the frame containing startWordIndex.
  useEffect(() => {
    let resumeIndex = 0;
    if (startWordIndex > 0) {
      resumeIndex = tokens.findIndex(
        (t) => t.startWordIndex + t.wordCount > startWordIndex
      );
      if (resumeIndex < 0) resumeIndex = 0;
    }
    indexRef.current = resumeIndex;
    frameElapsedRef.current = 0;
    activeMsRef.current = 0;
    wordsConsumedRef.current = 0;
    playingRef.current = false;
    setTokenIndex(resumeIndex);
    setIsPlaying(false);
    setIsComplete(false);
    return stopLoop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, tokens, stopLoop]);

  return {
    token: tokens[tokenIndex] ?? null,
    tokenIndex,
    totalTokens: tokens.length,
    progress: tokens.length > 0 ? tokenIndex / (tokens.length - 1 || 1) : 0,
    isPlaying,
    isComplete,
    wpm,
    chunkSize,
    metrics,
    play,
    pause,
    toggle,
    restart,
    skip,
    setWPM,
    setChunkSize,
  };
}
