"use client";

// ============================================================================
// ComprehensionQuiz — post-sprint test. Fetches AI-generated questions for
// the exact word range just read, grades locally, and persists the score to
// comprehension_tests linked to the rsvp_session.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, CheckCircle2, HelpCircle, Loader2, X, XCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { QuizQuestion } from "@/lib/types";

export interface ComprehensionQuizProps {
  bookId: string;
  /** Word range of the sprint just completed. */
  startWord: number;
  endWord: number;
  /** rsvp_sessions row to attach the score to (null = skip persistence). */
  rsvpSessionId: string | null;
  onClose: (scorePct: number | null) => void;
}

type QuizState =
  | { kind: "loading" }
  | { kind: "unavailable"; message: string }
  | { kind: "active"; questions: QuizQuestion[] }
  | { kind: "done"; questions: QuizQuestion[]; scorePct: number };

export default function ComprehensionQuiz({
  bookId,
  startWord,
  endWord,
  rsvpSessionId,
  onClose,
}: ComprehensionQuizProps) {
  const [state, setState] = useState<QuizState>({ kind: "loading" });
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setState({ kind: "unavailable", message: "Sign in to take comprehension tests." });
          return;
        }
        const res = await fetch("/api/quiz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ bookId, startWord, endWord }),
        });
        const payload = (await res.json()) as {
          questions?: QuizQuestion[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !payload.questions) {
          setState({
            kind: "unavailable",
            message: payload.error ?? "Could not generate a quiz.",
          });
          return;
        }
        setState({ kind: "active", questions: payload.questions });
      } catch {
        if (!cancelled) {
          setState({ kind: "unavailable", message: "Quiz service unreachable." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, startWord, endWord]);

  const submit = useCallback(async () => {
    if (state.kind !== "active") return;
    const correct = state.questions.filter(
      (q, i) => answers[i] === q.correct_index
    ).length;
    const scorePct = Math.round((correct / state.questions.length) * 100);
    setState({ kind: "done", questions: state.questions, scorePct });

    if (rsvpSessionId) {
      try {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("comprehension_tests").insert({
            user_id: user.id,
            rsvp_session_id: rsvpSessionId,
            score_pct: scorePct,
            questions: state.questions.map((q, i) => ({
              q: q.question,
              options: q.options,
              correctIdx: q.correct_index,
              chosenIdx: answers[i] ?? null,
            })),
          });
        }
      } catch (err) {
        console.error("Failed to save quiz score:", err);
      }
    }
  }, [state, answers, rsvpSessionId]);

  const allAnswered =
    state.kind === "active" &&
    state.questions.every((_, i) => answers[i] !== undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface-raised p-6"
      >
        <button
          onClick={() => onClose(state.kind === "done" ? state.scorePct : null)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-500 hover:bg-surface-overlay hover:text-white"
          aria-label="Close quiz"
        >
          <X size={18} />
        </button>

        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white">
          <HelpCircle size={18} className="text-accent-soft" />
          Comprehension test
        </h2>
        <p className="mb-6 text-sm text-neutral-400">
          Answer from memory — the passage stays closed.
        </p>

        {state.kind === "loading" && (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
            <Loader2 size={15} className="animate-spin" />
            Writing questions from the exact passage you just read…
          </p>
        )}

        {state.kind === "unavailable" && (
          <p className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-200">
            {state.message}
          </p>
        )}

        {(state.kind === "active" || state.kind === "done") && (
          <div className="flex flex-col gap-6">
            {state.questions.map((q, qi) => {
              const chosen = answers[qi];
              const graded = state.kind === "done";
              return (
                <div key={qi}>
                  <p className="mb-3 font-medium text-neutral-100">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((option, oi) => {
                      const isChosen = chosen === oi;
                      const isCorrect = q.correct_index === oi;
                      let cls = "border-neutral-800 text-neutral-300 hover:border-accent";
                      if (graded && isCorrect) {
                        cls = "border-emerald-700 bg-emerald-950/30 text-emerald-200";
                      } else if (graded && isChosen && !isCorrect) {
                        cls = "border-red-800 bg-red-950/30 text-red-300";
                      } else if (isChosen) {
                        cls = "border-accent bg-accent/10 text-white";
                      }
                      return (
                        <button
                          key={oi}
                          disabled={graded}
                          onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                          className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition ${cls}`}
                        >
                          {graded && isCorrect && <CheckCircle2 size={14} className="shrink-0" />}
                          {graded && isChosen && !isCorrect && (
                            <XCircle size={14} className="shrink-0" />
                          )}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {graded && (
                    <p className="mt-2 text-xs text-neutral-500">{q.explanation}</p>
                  )}
                </div>
              );
            })}

            {state.kind === "active" ? (
              <button
                onClick={() => void submit()}
                disabled={!allAnswered}
                className="rounded-lg bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
              >
                {allAnswered
                  ? "Grade my recall"
                  : `Answer all ${state.questions.length} questions to grade`}
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 p-4"
                >
                  <span className="flex items-center gap-2 text-white">
                    <Award size={18} className="text-amber-400" />
                    Score: <span className="font-mono text-xl">{state.scorePct}%</span>
                  </span>
                  <button
                    onClick={() => onClose(state.scorePct)}
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-soft"
                  >
                    Done
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
