"use client";

// ============================================================================
// DoctrineQueue — Module 3: Trigger-Based Doctrine Registry (sorted strictly
// by Context Cue) + masked-flashcard active recall queue + 66-day habit ring.
// ============================================================================

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  ChevronDown,
  Download,
  Flame,
  MessageSquareWarning,
  Search,
  Target,
  Zap,
} from "lucide-react";
import HabitHorizonRing from "@/components/HabitHorizonRing";
import MaskedReviewCard from "@/components/MaskedReviewCard";
import type { DoctrineRule, Habit, HabitLog, ReviewSchedule } from "@/lib/types";

export interface DoctrineQueueProps {
  rules: DoctrineRule[];
  schedules: ReviewSchedule[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  /** Persist an updated review schedule after grading. */
  onScheduleUpdate?: (updated: ReviewSchedule) => void;
  /** Promote a rule to a 66-day habit (insert into habits). */
  onStartHabit?: (ruleId: string) => void;
}

// ---------------------------------------------------------------------------
// Main registry — grouped and sorted STRICTLY by context cue, never by book.
// ---------------------------------------------------------------------------

export default function DoctrineQueue({
  rules,
  schedules,
  habits = [],
  habitLogs = [],
  onScheduleUpdate,
  onStartHabit,
}: DoctrineQueueProps) {
  const [openCue, setOpenCue] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const byCue = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const groups = new Map<string, DoctrineRule[]>();
    for (const rule of rules.filter((r) => r.is_active)) {
      if (
        needle &&
        ![rule.context_cue, rule.behavior_command, rule.why_true]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      ) {
        continue;
      }
      const list = groups.get(rule.context_cue) ?? [];
      list.push(rule);
      groups.set(rule.context_cue, list);
    }
    // Alphabetical by cue — deliberately NO grouping or ordering by book.
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rules, query]);

  const exportMarkdown = () => {
    const lines: string[] = ["# Living Doctrine", ""];
    for (const [cue, cueRules] of byCue) {
      lines.push(`## ${cue}`, "");
      for (const rule of cueRules) {
        lines.push(`- **If** ${rule.context_cue} **→ then** ${rule.behavior_command}`);
        if (rule.why_true) lines.push(`  - *Why true:* ${rule.why_true}`);
        if (rule.arguing_pair_clash) lines.push(`  - *Clash:* ${rule.arguing_pair_clash}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "living-doctrine.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const habitByRule = useMemo(
    () => new Map(habits.map((h) => [h.doctrine_rule_id, h])),
    [habits]
  );
  const logsByHabit = useMemo(() => {
    const m = new Map<string, HabitLog[]>();
    for (const log of habitLogs) {
      const list = m.get(log.habit_id) ?? [];
      list.push(log);
      m.set(log.habit_id, list);
    }
    return m;
  }, [habitLogs]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* -------------------------------------------- Active recall queue */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Brain size={18} className="text-accent-soft" />
          Active Recall Queue
        </h2>
        <MaskedReviewCard
          rules={rules}
          schedules={schedules}
          onScheduleUpdate={onScheduleUpdate}
        />
      </section>

      {/* -------------------------------------------- Trigger registry */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Target size={18} className="text-accent-soft" />
            Doctrine Registry
            <span className="text-xs font-normal text-neutral-500">
              sorted by trigger, never by book
            </span>
          </h2>
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-accent hover:text-white"
            title="Download all rules as a Markdown file"
          >
            <Download size={12} /> Export .md
          </button>
        </div>

        <div className="relative mb-3">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules by cue, command, or reason…"
            className="w-full rounded-lg border border-neutral-800 bg-surface-raised py-2.5 pl-9 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-2">
          {byCue.length === 0 && (
            <p className="rounded-xl border border-neutral-800 bg-surface p-6 text-center text-sm text-neutral-500">
              No doctrine rules yet. Run a brain dump, then extract
              If&nbsp;[Cue]&nbsp;→&nbsp;Then&nbsp;[Behavior] rules from it.
            </p>
          )}

          {byCue.map(([cue, cueRules]) => {
            const isOpen = openCue === cue;
            return (
              <div
                key={cue}
                className="overflow-hidden rounded-xl border border-neutral-800 bg-surface"
              >
                <button
                  onClick={() => setOpenCue(isOpen ? null : cue)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-surface-overlay"
                >
                  <span className="flex items-center gap-2">
                    <Zap size={14} className="text-amber-400" />
                    <span className="font-medium text-neutral-100">{cue}</span>
                    <span className="text-xs text-neutral-500">
                      {cueRules.length} rule{cueRules.length !== 1 && "s"}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-4 border-t border-neutral-800 p-4">
                        {cueRules.map((rule) => {
                          const habit = habitByRule.get(rule.id);
                          return (
                            <div key={rule.id} className="flex flex-col gap-3">
                              <p className="font-reader text-neutral-100">
                                <span className="text-neutral-500">If </span>
                                {rule.context_cue}
                                <span className="text-neutral-500"> → then </span>
                                <span className="text-white">{rule.behavior_command}</span>
                              </p>
                              {rule.why_true && (
                                <p className="text-sm text-neutral-400">
                                  <span className="text-neutral-300">Why true: </span>
                                  {rule.why_true}
                                </p>
                              )}
                              {rule.arguing_pair_clash && (
                                <p className="flex items-start gap-1.5 text-sm text-neutral-400">
                                  <MessageSquareWarning
                                    size={14}
                                    className="mt-0.5 shrink-0 text-orange-400"
                                  />
                                  <span>
                                    <span className="text-neutral-300">Clash: </span>
                                    {rule.arguing_pair_clash}
                                  </span>
                                </p>
                              )}
                              {habit ? (
                                <HabitHorizonRing
                                  habit={habit}
                                  logs={logsByHabit.get(habit.id) ?? []}
                                />
                              ) : (
                                onStartHabit && (
                                  <button
                                    onClick={() => onStartHabit(rule.id)}
                                    className="flex w-fit items-center gap-1.5 rounded-lg border border-orange-800/50 bg-orange-950/20 px-3 py-1.5 text-xs text-orange-300 transition hover:bg-orange-900/30"
                                  >
                                    <Flame size={12} />
                                    Start 66-day habit
                                  </button>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
