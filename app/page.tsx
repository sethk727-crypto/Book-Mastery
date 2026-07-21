"use client";

// ============================================================================
// Dashboard shell — demo wiring of the three modules with in-memory sample
// data. Replace the sample constants with Supabase queries once the schema
// in supabase/schema.sql is applied.
// ============================================================================

import { useState } from "react";
import Link from "next/link";
import { BookOpenText, BookUp2, Brain, Sun, Target } from "lucide-react";
import RSVPReader from "@/components/RSVPReader";
import ReconsolidationStudio from "@/components/ReconsolidationStudio";
import DoctrineQueue from "@/components/DoctrineQueue";
import DailyLiturgy from "@/components/DailyLiturgy";
import type {
  DoctrineRule,
  Habit,
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

export default function Home() {
  const [tab, setTab] = useState<Tab>("rsvp");
  const [studioOpen, setStudioOpen] = useState(false);

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
        <div className="text-center">
          <button
            onClick={() => setStudioOpen(true)}
            className="rounded-xl bg-accent px-6 py-3 font-medium text-white hover:bg-accent-soft"
          >
            Open Juxtaposition Studio (demo rewrite)
          </button>
          {studioOpen && (
            <ReconsolidationStudio
              rewrite={SAMPLE_REWRITE}
              onClose={() => setStudioOpen(false)}
            />
          )}
        </div>
      )}

      {tab === "liturgy" && (
        <DailyLiturgy
          rules={SAMPLE_RULES}
          schedules={SAMPLE_SCHEDULES}
          habits={[SAMPLE_HABIT]}
          habitLogs={SAMPLE_HABIT_LOGS}
          onScheduleUpdate={(updated) => {
            // TODO: upsert into review_schedules via lib/supabase.
            console.info("Schedule updated:", updated);
          }}
          onHabitLog={(habitId, status) => {
            // TODO: insert into habit_logs via lib/supabase.
            console.info("Habit log:", habitId, status);
          }}
        />
      )}

      {tab === "doctrine" && (
        <DoctrineQueue
          rules={SAMPLE_RULES}
          schedules={SAMPLE_SCHEDULES}
          habits={[SAMPLE_HABIT]}
          habitLogs={SAMPLE_HABIT_LOGS}
          onScheduleUpdate={(updated) => {
            // TODO: upsert into review_schedules via lib/supabase.
            console.info("Schedule updated:", updated);
          }}
        />
      )}
    </main>
  );
}
