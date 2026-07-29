"use client";

// ============================================================================
// ProgressHub — the motivation dashboard: level + XP bar with reader titles,
// a daily reading goal ring, and the achievement badge wall. Everything is
// derived from data already in Supabase; signed-out users see demo numbers.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  Crown,
  Flame,
  Gauge,
  GraduationCap,
  HelpCircle,
  Landmark,
  Library,
  Loader2,
  Lock,
  Medal,
  PenLine,
  Rocket,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  BADGES,
  computeStreak,
  computeXP,
  EMPTY_STATS,
  levelFromXP,
  titleForLevel,
  xpForLevel,
  type LearnerStats,
} from "@/lib/gamification";
import { getSupabase } from "@/lib/supabase";

const BADGE_ICONS: Record<string, LucideIcon> = {
  Zap,
  BookOpen,
  Library,
  Crown,
  Gauge,
  Rocket,
  HelpCircle,
  Award,
  GraduationCap,
  Flame,
  Trophy,
  Scale,
  Landmark,
  Brain,
  CheckCircle2,
  Medal,
  PenLine,
  Sparkles,
};

const DEMO_STATS: LearnerStats = {
  ...EMPTY_STATS,
  totalWords: 12400,
  sprints: 6,
  minutes: 38,
  peakWPM: 520,
  streakDays: 3,
  quizzes: 2,
  avgScore: 70,
  rules: 2,
  reviewsDone: 4,
  habitChecks: 5,
  dumps: 1,
  rewrites: 1,
};

const DEFAULT_DAILY_GOAL = 2000;

export default function ProgressHub() {
  const [stats, setStats] = useState<LearnerStats | null>(null);
  const [wordsToday, setWordsToday] = useState(0);
  const [isDemo, setIsDemo] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_DAILY_GOAL);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("goal:dailyWords"));
      if (saved >= 100) setDailyGoal(saved);
    } catch {
      // default stands
    }
  }, []);

  const changeGoal = useCallback((value: number) => {
    const goal = Math.max(100, Math.min(50_000, value));
    setDailyGoal(goal);
    try {
      localStorage.setItem("goal:dailyWords", String(goal));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setStats(DEMO_STATS);
            setWordsToday(650);
            setIsDemo(true);
          }
          return;
        }

        const [sessions, tests, rules, schedules, habitLogs, dumps, rewrites] =
          await Promise.all([
            supabase.from("rsvp_sessions").select("words_consumed, active_ms, peak_wpm, started_at"),
            supabase.from("comprehension_tests").select("score_pct"),
            supabase.from("doctrine_rules").select("id"),
            supabase.from("review_schedules").select("total_reviews"),
            supabase.from("habit_logs").select("id").eq("status", "completed"),
            supabase.from("brain_dumps").select("id").not("submitted_at", "is", null),
            supabase.from("schema_rewrites").select("id"),
          ]);
        if (cancelled) return;

        const rows = sessions.data ?? [];
        const scores = (tests.data ?? []).map((t) => Number(t.score_pct));
        const todayIso = new Date().toISOString().slice(0, 10);

        setStats({
          totalWords: rows.reduce((a, r) => a + (r.words_consumed ?? 0), 0),
          sprints: rows.length,
          minutes: Math.round(rows.reduce((a, r) => a + (r.active_ms ?? 0), 0) / 60_000),
          peakWPM: rows.reduce((a, r) => Math.max(a, Number(r.peak_wpm ?? 0)), 0),
          streakDays: computeStreak(rows.map((r) => r.started_at as string).filter(Boolean)),
          quizzes: scores.length,
          perfectQuizzes: scores.filter((s) => s >= 100).length,
          avgScore: scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0,
          rules: (rules.data ?? []).length,
          reviewsDone: (schedules.data ?? []).reduce(
            (a, s) => a + (s.total_reviews ?? 0),
            0
          ),
          habitChecks: (habitLogs.data ?? []).length,
          dumps: (dumps.data ?? []).length,
          rewrites: (rewrites.data ?? []).length,
        });
        setWordsToday(
          rows
            .filter((r) => (r.started_at as string | null)?.slice(0, 10) === todayIso)
            .reduce((a, r) => a + (r.words_consumed ?? 0), 0)
        );
        setIsDemo(false);
      } catch {
        if (!cancelled) {
          setStats(DEMO_STATS);
          setWordsToday(650);
          setIsDemo(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(() => {
    if (!stats) return null;
    const xp = computeXP(stats);
    const level = levelFromXP(xp);
    const currentFloor = xpForLevel(level);
    const nextFloor = xpForLevel(level + 1);
    return {
      xp,
      level,
      title: titleForLevel(level),
      progressToNext: (xp - currentFloor) / (nextFloor - currentFloor),
      xpToNext: nextFloor - xp,
      earned: BADGES.filter((b) => b.earned(stats)),
    };
  }, [stats]);

  if (!stats || !derived) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
        <Loader2 size={15} className="animate-spin" /> Tallying your progress…
      </p>
    );
  }

  const goalProgress = Math.min(1, wordsToday / dailyGoal);
  const goalDone = wordsToday >= dailyGoal;
  const RING = 2 * Math.PI * 44;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {isDemo && (
        <p className="text-center text-xs text-neutral-600">
          Demo numbers — sign in to track your real progress.
        </p>
      )}

      {/* ------------------------------------------------ Level card */}
      <section className="rounded-2xl border border-neutral-800 bg-surface-raised p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Level {derived.level}
            </p>
            <h2 className="bg-gradient-to-r from-atmos-dawnGold via-atmos-coral to-atmos-twilight bg-clip-text text-2xl font-bold text-transparent">
              {derived.title}
            </h2>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl text-white">
              {derived.xp.toLocaleString()} XP
            </p>
            <p className="text-xs text-neutral-500">
              {derived.xpToNext.toLocaleString()} XP to level {derived.level + 1}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-atmos-dawnGold via-atmos-coral to-atmos-twilight"
            initial={{ width: 0 }}
            animate={{ width: `${derived.progressToNext * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          XP comes from everything: words read, sprints, quizzes, rules forged,
          reviews, habit check-ins, brain dumps, and schema rewrites — the
          deeper the work, the more it pays.
        </p>
      </section>

      {/* ------------------------------------------------ Daily goal ring */}
      <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-neutral-800 bg-surface-raised p-6">
        <div className="relative">
          <svg width={110} height={110} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={44} fill="none" stroke="#27272a" strokeWidth={7} />
            <motion.circle
              cx={50}
              cy={50}
              r={44}
              fill="none"
              stroke={goalDone ? "#FFC857" : "#FF8A65"}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={RING}
              initial={{ strokeDashoffset: RING }}
              animate={{ strokeDashoffset: RING * (1 - goalProgress) }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {goalDone ? (
              <Trophy size={20} className="text-atmos-dawnGold" />
            ) : (
              <Target size={18} className="text-atmos-coral" />
            )}
            <span className="mt-0.5 font-mono text-sm text-white">
              {Math.round(goalProgress * 100)}%
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">Today&apos;s reading goal</h3>
          <p className="mt-1 text-sm text-neutral-400">
            <span className="font-mono text-neutral-100">
              {wordsToday.toLocaleString()}
            </span>{" "}
            of{" "}
            <input
              type="number"
              value={dailyGoal}
              min={100}
              step={100}
              onChange={(e) => changeGoal(Number(e.target.value))}
              className="w-20 rounded-md border border-neutral-800 bg-surface px-1.5 py-0.5 text-center font-mono text-sm text-neutral-100 outline-none focus:border-accent"
            />{" "}
            words today.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            {goalDone
              ? "Goal hit — the streak lives another day. 🔥"
              : `${(dailyGoal - wordsToday).toLocaleString()} words to go — one short sprint.`}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------ Badge wall */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Medal size={17} className="text-atmos-dawnGold" />
          Achievements
          <span className="text-xs font-normal text-neutral-500">
            {derived.earned.length} / {BADGES.length}
          </span>
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BADGES.map((badge) => {
            const earned = badge.earned(stats);
            const Icon = BADGE_ICONS[badge.icon] ?? Medal;
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-3 transition ${
                  earned
                    ? "border-atmos-dawnGold/40 bg-atmos-dawnGold/5"
                    : "border-neutral-800 bg-surface opacity-60"
                }`}
                title={earned ? badge.description : badge.hint}
              >
                <div className="flex items-center gap-2">
                  {earned ? (
                    <Icon size={16} className="shrink-0 text-atmos-dawnGold" />
                  ) : (
                    <Lock size={14} className="shrink-0 text-neutral-600" />
                  )}
                  <span
                    className={`truncate text-sm font-medium ${
                      earned ? "text-neutral-100" : "text-neutral-500"
                    }`}
                  >
                    {badge.name}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                  {earned ? badge.description : badge.hint}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
