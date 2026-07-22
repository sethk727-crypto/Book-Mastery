"use client";

// ============================================================================
// Dashboard shell — demo wiring of the three modules with in-memory sample
// data. Replace the sample constants with Supabase queries once the schema
// in supabase/schema.sql is applied.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenText, BookUp2, Brain, Sun, Target } from "lucide-react";
import RSVPReader from "@/components/RSVPReader";
import ReconsolidationStudio from "@/components/ReconsolidationStudio";
import RewriteWizard, { type RewriteDraft } from "@/components/RewriteWizard";
import DoctrineQueue from "@/components/DoctrineQueue";
import DailyLiturgy from "@/components/DailyLiturgy";
import { getSupabase } from "@/lib/supabase";
import type {
  DoctrineRule,
  Habit,
  HabitDayStatus,
  HabitLog,
  ReviewSchedule,
  SchemaRewrite,
} from "@/lib/types";

const SAMPLE_TEXT = `Deep work is the ability to focus without distraction on a cognitively demanding task. It is a skill that allows you to quickly master complicated information and produce better results in less time.

Most knowledge workers have lost this ability. They spend their days in a haze of email, meetings, and shallow busywork, mistaking motion for progress. The consequence is severe: work that could take hours stretches into weeks, and the deep satisfaction of craftsmanship never arrives.

The solution is not more effort but better structure. Schedule blocks of uninterrupted concentration, protect them ruthlessly, and treat your attention as the scarcest resource you own. Depth, practiced daily, compounds into an unassailable professional advantage.`;

const SAMPLE_REWRITE: SchemaRewrite = {
  id: "demo-rewrite-1",
  user_id: "demo-user",
  book_id: null,
  status: "juxtaposed",
  friction_description: "I compulsively check email every few minutes while working.",
  old_schema:
    "If I don't respond instantly, people will think I'm unreliable and I'll fall behind.",
  old_schema_emotional_charge: 7,
  disconfirming_evidence:
    "Knowledge workers who batch communication twice daily are rated MORE reliable by colleagues, because their deep-work output is dramatically higher and their replies are more considered.",
  evidence_source_locator: "Deep Work, ch. 4 — 'Quit Social Media', p. 187",
  juxtaposed_at: null,
  window_opened_at: null,
  window_closes_at: null,
  recall_reps_required: 3,
  recall_reps_completed: 0,
  verified_at: null,
  verification_notes: null,
  permanence_score: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_RULES: DoctrineRule[] = [
  {
    id: "rule-1",
    user_id: "demo-user",
    book_id: null,
    brain_dump_id: null,
    context_cue: "Morning Coffee",
    behavior_command: "Write the day's single most important task on paper before opening any app.",
    why_true:
      "Pre-commitment beats willpower: choosing the priority before dopamine triggers fire prevents reactive shallow work.",
    arguing_pair_clash:
      "'But urgent things come up overnight!' — True, and they will still be there at 9:30; 90 minutes of depth first costs nothing real.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rule-2",
    user_id: "demo-user",
    book_id: null,
    brain_dump_id: null,
    context_cue: "Before Opening Email",
    behavior_command: "State out loud what I am looking for, and set a 10-minute timer.",
    why_true:
      "Email is an attention slot machine; entering with a query and a timebox converts it from a feed into a tool.",
    arguing_pair_clash:
      "'Timers feel rigid' — the rigidity is the point: the constraint is what preserves the rest of the day.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const SAMPLE_SCHEDULES: ReviewSchedule[] = SAMPLE_RULES.map((rule, i) => ({
  id: `sched-${i + 1}`,
  doctrine_rule_id: rule.id,
  user_id: "demo-user",
  stage: 0,
  next_review_at: new Date(Date.now() - 60_000).toISOString(), // due now
  last_outcome: "pending",
  last_reviewed_at: null,
  total_reviews: 0,
  total_lapses: 0,
}));

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const SAMPLE_HABIT: Habit = {
  id: "habit-1",
  user_id: "demo-user",
  doctrine_rule_id: "rule-1",
  started_on: daysAgo(11),
  horizon_days: 66,
  completed_at: null,
  abandoned_at: null,
};

const SAMPLE_HABIT_LOGS: HabitLog[] = [
  ...[11, 10, 9, 8, 6, 5, 4, 3, 2, 1].map((n, i) => ({
    id: `log-${i}`,
    habit_id: "habit-1",
    user_id: "demo-user",
    log_date: daysAgo(n),
    status: "completed" as const,
    note: null,
  })),
  // day 7 was a single miss — tolerated, streak holds
];

type Tab = "rsvp" | "reconsolidation" | "doctrine" | "liturgy";

const TABS: Array<{ id: Tab; label: string; icon: typeof Brain }> = [
  { id: "rsvp", label: "RSVP Reader", icon: BookOpenText },
  { id: "reconsolidation", label: "Reconsolidation Studio", icon: Brain },
  { id: "doctrine", label: "Living Doctrine", icon: Target },
  { id: "liturgy", label: "Daily Liturgy", icon: Sun },
];

type DataMode = "loading" | "demo" | "live";

export default function Home() {
  const [tab, setTab] = useState<Tab>("rsvp");
  const [mode, setMode] = useState<DataMode>("loading");
  const [rules, setRules] = useState<DoctrineRule[]>(SAMPLE_RULES);
  const [schedules, setSchedules] = useState<ReviewSchedule[]>(SAMPLE_SCHEDULES);
  const [habits, setHabits] = useState<Habit[]>([SAMPLE_HABIT]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(SAMPLE_HABIT_LOGS);
  const [rewrites, setRewrites] = useState<SchemaRewrite[]>([SAMPLE_REWRITE]);
  const [openRewrite, setOpenRewrite] = useState<SchemaRewrite | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Load the signed-in user's real doctrine; fall back to demo data.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = getSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setMode("demo");
          return;
        }
        const [rulesRes, schedulesRes, habitsRes, logsRes, rewritesRes] =
          await Promise.all([
            supabase.from("doctrine_rules").select("*"),
            supabase.from("review_schedules").select("*"),
            supabase.from("habits").select("*"),
            supabase.from("habit_logs").select("*"),
            supabase
              .from("schema_rewrites")
              .select("*")
              .order("created_at", { ascending: false }),
          ]);
        if (cancelled) return;
        setRules((rulesRes.data as DoctrineRule[] | null) ?? []);
        setSchedules((schedulesRes.data as ReviewSchedule[] | null) ?? []);
        setHabits((habitsRes.data as Habit[] | null) ?? []);
        setHabitLogs((logsRes.data as HabitLog[] | null) ?? []);
        setRewrites((rewritesRes.data as SchemaRewrite[] | null) ?? []);
        setMode("live");
      } catch {
        if (!cancelled) setMode("demo");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScheduleUpdate = useCallback(
    (updated: ReviewSchedule) => {
      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (mode !== "live") return;
      void getSupabase()
        .from("review_schedules")
        .update({
          stage: updated.stage,
          next_review_at: updated.next_review_at,
          last_outcome: updated.last_outcome,
          last_reviewed_at: updated.last_reviewed_at,
          total_reviews: updated.total_reviews,
          total_lapses: updated.total_lapses,
        })
        .eq("id", updated.id)
        .then(({ error }) => {
          if (error) console.error("Failed to save review:", error.message);
        });
    },
    [mode]
  );

  const handleHabitLog = useCallback(
    (habitId: string, status: HabitDayStatus) => {
      const today = new Date().toISOString().slice(0, 10);
      setHabitLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          habit_id: habitId,
          user_id: "",
          log_date: today,
          status,
          note: null,
        },
      ]);
      if (mode !== "live") return;
      void (async () => {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from("habit_logs").insert({
          habit_id: habitId,
          user_id: user.id,
          log_date: today,
          status,
        });
        if (error) console.error("Failed to log habit:", error.message);
      })();
    },
    [mode]
  );

  // ---- Reconsolidation: create rewrites and persist window/rep updates ----
  const handleSaveRewrite = useCallback(
    (draft: RewriteDraft) => {
      setWizardOpen(false);
      const local: SchemaRewrite = {
        id: crypto.randomUUID(),
        user_id: "local",
        book_id: draft.book_id,
        status: "evidence_extracted",
        friction_description: draft.friction_description,
        old_schema: draft.old_schema,
        old_schema_emotional_charge: draft.old_schema_emotional_charge,
        disconfirming_evidence: draft.disconfirming_evidence,
        evidence_source_locator: draft.evidence_source_locator || null,
        juxtaposed_at: null,
        window_opened_at: null,
        window_closes_at: null,
        recall_reps_required: 3,
        recall_reps_completed: 0,
        verified_at: null,
        verification_notes: null,
        permanence_score: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (mode !== "live") {
        setRewrites((prev) => [local, ...prev]);
        setOpenRewrite(local);
        return;
      }
      void (async () => {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("schema_rewrites")
          .insert({
            user_id: user.id,
            book_id: draft.book_id,
            status: "evidence_extracted",
            friction_description: draft.friction_description,
            old_schema: draft.old_schema,
            old_schema_emotional_charge: draft.old_schema_emotional_charge,
            disconfirming_evidence: draft.disconfirming_evidence,
            evidence_source_locator: draft.evidence_source_locator || null,
          })
          .select("*")
          .single<SchemaRewrite>();
        if (error || !data) {
          console.error("Failed to save rewrite:", error?.message);
          setRewrites((prev) => [local, ...prev]);
          setOpenRewrite(local);
          return;
        }
        setRewrites((prev) => [data, ...prev]);
        setOpenRewrite(data);
      })();
    },
    [mode]
  );

  const patchRewrite = useCallback(
    (id: string, patch: Partial<SchemaRewrite>) => {
      setRewrites((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setOpenRewrite((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
      if (mode !== "live") return;
      void getSupabase()
        .from("schema_rewrites")
        .update(patch)
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("Failed to save rewrite update:", error.message);
        });
    },
    [mode]
  );

  const handleStartHabit = useCallback(
    (ruleId: string) => {
      if (mode !== "live") {
        setHabits((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            user_id: "demo-user",
            doctrine_rule_id: ruleId,
            started_on: new Date().toISOString().slice(0, 10),
            horizon_days: 66,
            completed_at: null,
            abandoned_at: null,
          },
        ]);
        return;
      }
      void (async () => {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("habits")
          .insert({ user_id: user.id, doctrine_rule_id: ruleId })
          .select("*")
          .single<Habit>();
        if (error || !data) {
          console.error("Failed to start habit:", error?.message);
          return;
        }
        setHabits((prev) => [...prev, data]);
      })();
    },
    [mode]
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">NeuroAbsorption Engine</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Read fast → rewrite the schema → install the doctrine.
        </p>
        <Link
          href="/absorb"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent-soft transition hover:bg-accent/20"
        >
          <BookUp2 size={14} />
          Start the absorption pipeline (upload a PDF)
        </Link>
        {mode === "demo" && (
          <p className="mt-3 text-xs text-neutral-600">
            Showing demo data —{" "}
            <Link href="/login" className="underline hover:text-neutral-400">
              sign in
            </Link>{" "}
            to see your own rules and habits.
          </p>
        )}
      </header>

      <nav className="mb-8 flex justify-center gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${
              tab === id
                ? "bg-accent text-white"
                : "bg-surface-raised text-neutral-400 hover:text-white"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {tab === "rsvp" && (
        <RSVPReader
          text={SAMPLE_TEXT}
          initialWPM={350}
          onSprintComplete={(metrics) => {
            // TODO: insert into rsvp_sessions via lib/supabase.
            console.info("Sprint metrics:", metrics);
          }}
        />
      )}

      {tab === "reconsolidation" && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              Log a mental block, retrieve the old belief, and juxtapose it
              with evidence from your reading. Tip: save passages via your
              book&apos;s <span className="text-neutral-200">Search</span> panel
              — they prefill Step C here.
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft"
            >
              + New schema rewrite
            </button>
          </div>

          {rewrites.length === 0 ? (
            <p className="rounded-xl border border-neutral-800 bg-surface p-8 text-center text-sm text-neutral-500">
              No rewrites yet. Start with the friction you want gone.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {rewrites.map((rewrite) => {
                const windowOpen =
                  rewrite.status === "window_open" &&
                  rewrite.window_opened_at &&
                  Date.now() <
                    new Date(rewrite.window_opened_at).getTime() + 5 * 3600_000;
                return (
                  <button
                    key={rewrite.id}
                    onClick={() => setOpenRewrite(rewrite)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-surface p-4 text-left transition hover:border-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-100">
                        {rewrite.friction_description}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        Old belief: {rewrite.old_schema ?? "—"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                        windowOpen
                          ? "animate-pulseRing bg-accent/20 text-accent-soft"
                          : rewrite.status === "window_closed"
                            ? "bg-emerald-950/60 text-emerald-300"
                            : "bg-surface-overlay text-neutral-400"
                      }`}
                    >
                      {windowOpen
                        ? "window open"
                        : rewrite.status.replace(/_/g, " ")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {wizardOpen && (
            <RewriteWizard
              onSave={handleSaveRewrite}
              onClose={() => setWizardOpen(false)}
            />
          )}

          {openRewrite && (
            <ReconsolidationStudio
              key={openRewrite.id}
              rewrite={openRewrite}
              onWindowOpened={(openedAt) =>
                patchRewrite(openRewrite.id, {
                  status: "window_open",
                  juxtaposed_at: new Date().toISOString(),
                  window_opened_at: openedAt.toISOString(),
                })
              }
              onRepComplete={(ordinal) =>
                patchRewrite(openRewrite.id, { recall_reps_completed: ordinal })
              }
              onWindowClosed={() =>
                patchRewrite(openRewrite.id, { status: "window_closed" })
              }
              onClose={() => setOpenRewrite(null)}
            />
          )}
        </div>
      )}

      {tab === "liturgy" && (
        <DailyLiturgy
          rules={rules}
          schedules={schedules}
          habits={habits}
          habitLogs={habitLogs}
          onScheduleUpdate={handleScheduleUpdate}
          onHabitLog={handleHabitLog}
        />
      )}

      {tab === "doctrine" && (
        <DoctrineQueue
          rules={rules}
          schedules={schedules}
          habits={habits}
          habitLogs={habitLogs}
          onScheduleUpdate={handleScheduleUpdate}
          onStartHabit={handleStartHabit}
        />
      )}
    </main>
  );
}
