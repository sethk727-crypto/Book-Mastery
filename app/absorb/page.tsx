"use client";

// ============================================================================
// /absorb — the full absorption pipeline as a state machine:
//   upload → sprint (locked reading) → recall chamber → rule studio → done
// Persists each stage to Supabase; requires a signed-in session.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookUp2, CheckCircle2, LogIn } from "lucide-react";
import PDFUploadDropzone from "@/components/PDFUploadDropzone";
import SprintReader from "@/components/SprintReader";
import RecallChamber from "@/components/RecallChamber";
import RuleStudio, { type DraftRule } from "@/components/RuleStudio";
import { getSupabase } from "@/lib/supabase";
import { initialSchedule } from "@/lib/spacedRepetition";
import type { Book, BrainDump, RSVPMetrics } from "@/lib/types";

type Stage =
  | { name: "upload" }
  | { name: "sprint"; book: Book }
  | { name: "recall"; book: Book }
  | { name: "rules"; book: Book; dump: BrainDump | null; dumpMarkdown: string };

const STAGE_LABELS = ["Upload", "Sprint", "Recall", "Doctrine"] as const;

type AuthGate = "checking" | "in" | "out" | "unconfigured";

export default function AbsorbPage() {
  const [stage, setStage] = useState<Stage>({ name: "upload" });
  const [persistError, setPersistError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthGate>("checking");

  useEffect(() => {
    try {
      const supabase = getSupabase();
      void supabase.auth
        .getSession()
        .then(({ data: { session } }) => setAuth(session ? "in" : "out"));
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
        setAuth(session ? "in" : "out")
      );
      return () => sub.subscription.unsubscribe();
    } catch {
      setAuth("unconfigured");
    }
  }, []);

  const stageIndex =
    stage.name === "upload" ? 0 : stage.name === "sprint" ? 1 : stage.name === "recall" ? 2 : 3;

  // ---- Stage 1 -> 2: sprint metrics --------------------------------------
  const persistSprint = useCallback(async (book: Book, metrics: RSVPMetrics) => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("rsvp_sessions").insert({
        user_id: user.id,
        book_id: book.id,
        ended_at: new Date().toISOString(),
        words_consumed: metrics.wordsConsumed,
        active_ms: metrics.activeMs,
        avg_wpm: metrics.effectiveWPM,
        peak_wpm: metrics.peakWPM,
      });
    } catch (err) {
      setPersistError(err instanceof Error ? err.message : "Failed to save sprint");
    }
  }, []);

  // ---- Stage 2 -> 3: brain dump ------------------------------------------
  const persistDump = useCallback(
    async (book: Book, markdown: string, wordCount: number) => {
      let dump: BrainDump | null = null;
      try {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("brain_dumps")
            .insert({
              user_id: user.id,
              book_id: book.id,
              markdown_body: markdown,
              submitted_at: new Date().toISOString(),
              word_count: wordCount,
            })
            .select("*")
            .single<BrainDump>();
          dump = data;
        }
      } catch (err) {
        setPersistError(err instanceof Error ? err.message : "Failed to save dump");
      }
      setStage({ name: "rules", book, dump, dumpMarkdown: markdown });
    },
    []
  );

  // ---- Stage 4: doctrine rules + initial review schedule ------------------
  const persistRule = useCallback(
    async (book: Book, dumpId: string | null, rule: DraftRule) => {
      try {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: saved, error } = await supabase
          .from("doctrine_rules")
          .insert({
            user_id: user.id,
            book_id: book.id,
            brain_dump_id: dumpId,
            ...rule,
          })
          .select("id")
          .single<{ id: string }>();
        if (error || !saved) throw new Error(error?.message ?? "Rule insert failed");

        const { stage: reviewStage, nextReviewAt } = initialSchedule();
        await supabase.from("review_schedules").insert({
          doctrine_rule_id: saved.id,
          user_id: user.id,
          stage: reviewStage,
          next_review_at: nextReviewAt.toISOString(),
        });
      } catch (err) {
        setPersistError(err instanceof Error ? err.message : "Failed to save rule");
      }
    },
    []
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
          <BookUp2 size={22} className="text-accent-soft" />
          Absorption Pipeline
        </h1>
        {/* Stage rail */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs">
          {STAGE_LABELS.map((label, i) => (
            <span key={label} className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 ${
                  i < stageIndex
                    ? "bg-emerald-950/60 text-emerald-300"
                    : i === stageIndex
                      ? "bg-accent text-white"
                      : "bg-surface-raised text-neutral-500"
                }`}
              >
                {i < stageIndex ? <CheckCircle2 size={11} className="mr-1 inline" /> : null}
                {label}
              </span>
              {i < STAGE_LABELS.length - 1 && (
                <ArrowRight size={12} className="text-neutral-600" />
              )}
            </span>
          ))}
        </div>
      </header>

      {persistError && (
        <p className="mx-auto mb-6 max-w-xl rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-center text-sm text-red-300">
          Persistence warning: {persistError} (the flow continues locally)
        </p>
      )}

      {stage.name === "upload" && auth === "checking" && (
        <p className="text-center text-sm text-neutral-500">Checking your session…</p>
      )}

      {stage.name === "upload" && auth === "unconfigured" && (
        <div className="mx-auto flex max-w-xl items-start gap-2 rounded-xl border border-amber-700/50 bg-amber-950/20 p-5 text-sm text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            The database isn&apos;t connected yet, so uploads are disabled.
            Create a free Supabase project, run the two files in{" "}
            <code className="font-mono text-xs">supabase/</code>, and set the
            three keys from <code className="font-mono text-xs">.env.example</code>{" "}
            — full steps are in the README. The dashboard demo on the{" "}
            <Link href="/" className="underline">home page</Link> works without it.
          </span>
        </div>
      )}

      {stage.name === "upload" && auth === "out" && (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-surface-raised p-8 text-center">
          <p className="text-sm text-neutral-300">
            Sign in first so your books and progress are saved to your account.
          </p>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-soft"
          >
            <LogIn size={15} />
            Sign in with email
          </Link>
        </div>
      )}

      {stage.name === "upload" && auth === "in" && (
        <PDFUploadDropzone
          onBookReady={(book) => setStage({ name: "sprint", book })}
        />
      )}

      {stage.name === "sprint" && (
        <SprintReader
          book={stage.book}
          onSprintComplete={(metrics) => void persistSprint(stage.book, metrics)}
          onFinishBook={() => setStage({ name: "recall", book: stage.book })}
        />
      )}

      {stage.name === "recall" && (
        <RecallChamber
          bookTitle={stage.book.title}
          onSubmit={(markdown, wordCount) =>
            void persistDump(stage.book, markdown, wordCount)
          }
        />
      )}

      {stage.name === "rules" && (
        <div className="flex flex-col gap-6">
          <RuleStudio
            brainDumpMarkdown={stage.dumpMarkdown}
            onSaveRule={(rule) =>
              void persistRule(stage.book, stage.dump?.id ?? null, rule)
            }
          />
          <p className="text-center text-sm text-neutral-500">
            Done forging?{" "}
            <Link href="/" className="text-accent-soft underline">
              Return to the Living Doctrine
            </Link>{" "}
            — each saved rule enters tomorrow&apos;s Daily Liturgy queue.
          </p>
        </div>
      )}
    </main>
  );
}
