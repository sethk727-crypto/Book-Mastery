"use client";

// ============================================================================
// RecallChamber — timed free-recall brain dump. Opens the moment "Finish
// Book" is pressed: the source PDF is locked, and a blank markdown editor
// counts down 10 minutes. Auto-submits at zero.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, PenLine, Send, TimerReset } from "lucide-react";

export interface RecallChamberProps {
  bookTitle: string;
  /** Recall window length; defaults to the canonical 10 minutes. */
  durationSeconds?: number;
  /** Persist to brain_dumps: markdown body + word count. */
  onSubmit: (markdown: string, wordCount: number) => void;
}

export default function RecallChamber({
  bookTitle,
  durationSeconds = 600,
  onSubmit,
}: RecallChamberProps) {
  const [markdown, setMarkdown] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittedRef = useRef(false);
  const markdownRef = useRef("");
  markdownRef.current = markdown;

  const wordCount = useMemo(
    () => (markdown.trim() ? markdown.trim().split(/\s+/).length : 0),
    [markdown]
  );

  const submit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    const body = markdownRef.current;
    onSubmit(body, body.trim() ? body.trim().split(/\s+/).length : 0);
  };

  // Countdown; auto-submit at zero so the dump is never lost.
  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  // Drop the user straight into the editor.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const urgent = secondsLeft <= 60 && !submitted;

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-800 bg-emerald-950/20 p-8 text-center">
        <p className="font-medium text-emerald-300">
          Brain dump captured — {wordCount} words of raw recall.
        </p>
        <p className="mt-2 text-sm text-neutral-400">
          Next: forge it into If → Then doctrine in the Rule Studio.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Lock size={14} className="text-amber-400" />
          <span>
            <span className="text-neutral-200">{bookTitle}</span> is locked
            until you submit
          </span>
        </div>
        <motion.span
          animate={urgent ? { scale: [1, 1.08, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
          className={`flex items-center gap-1.5 font-mono text-2xl tabular-nums ${
            urgent ? "text-orp" : "text-white"
          }`}
        >
          <TimerReset size={18} className="text-accent-soft" />
          {mm}:{ss}
        </motion.span>
      </div>

      <textarea
        ref={textareaRef}
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder={
          "Everything you remember. Ugly is fine — structure comes later.\n\n" +
          "- core arguments\n- surprising claims\n- what you'd tell a friend\n- what you disagreed with"
        }
        spellCheck={false}
        className="min-h-[420px] w-full resize-y rounded-2xl border border-neutral-800 bg-surface-raised p-6 font-mono text-sm leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
      />

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <PenLine size={12} />
          {wordCount} words · markdown supported · auto-submits at 00:00
        </span>
        <button
          onClick={submit}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft"
        >
          <Send size={14} />
          Submit dump
        </button>
      </div>
    </div>
  );
}
