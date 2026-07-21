"use client";

// ============================================================================
// RuleStudio — forges raw brain-dump memory into concise doctrine:
//   If [Context Cue] → Then [Behavior Command]
// backed by mandatory elaborative interrogation ("Why is this true?" and the
// Arguing Pair Clash steelman). Validation enforces trigger-shaped cues and
// imperative, bounded commands.
// ============================================================================

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ListChecks,
  MessageSquareWarning,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";

export interface DraftRule {
  context_cue: string;
  behavior_command: string;
  why_true: string;
  arguing_pair_clash: string;
}

export interface RuleStudioProps {
  /** The raw dump shown alongside the form for mining. */
  brainDumpMarkdown: string;
  /** Persist one doctrine_rules row (+ its initial review_schedules row). */
  onSaveRule: (rule: DraftRule) => void;
}

const CUE_MAX = 60;
const COMMAND_MAX = 140;

interface FieldErrors {
  context_cue?: string;
  behavior_command?: string;
  why_true?: string;
  arguing_pair_clash?: string;
}

function validate(draft: DraftRule): FieldErrors {
  const errors: FieldErrors = {};

  const cue = draft.context_cue.trim();
  if (!cue) errors.context_cue = "Name the concrete trigger moment.";
  else if (cue.length > CUE_MAX)
    errors.context_cue = `Keep the cue under ${CUE_MAX} characters — it must be recognizable in the moment.`;
  else if (/^(always|never|when i feel|sometimes)/i.test(cue))
    errors.context_cue =
      "Too vague. Anchor to an observable moment: “Morning Coffee”, “Before opening email”.";

  const cmd = draft.behavior_command.trim();
  if (!cmd) errors.behavior_command = "State the exact behavior.";
  else if (cmd.length > COMMAND_MAX)
    errors.behavior_command = `Keep the command under ${COMMAND_MAX} characters — one executable action.`;
  else if (/^(try to|maybe|consider|think about)/i.test(cmd))
    errors.behavior_command =
      "No hedging. Start with an imperative verb: “Write…”, “Close…”, “Ask…”.";

  if (!draft.why_true.trim())
    errors.why_true = "Elaborative interrogation is mandatory: why is this rule true?";
  if (!draft.arguing_pair_clash.trim())
    errors.arguing_pair_clash =
      "Steelman the opposing view and defeat it — untested rules don't stick.";

  return errors;
}

const EMPTY_DRAFT: DraftRule = {
  context_cue: "",
  behavior_command: "",
  why_true: "",
  arguing_pair_clash: "",
};

export default function RuleStudio({ brainDumpMarkdown, onSaveRule }: RuleStudioProps) {
  const [draft, setDraft] = useState<DraftRule>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [savedRules, setSavedRules] = useState<DraftRule[]>([]);

  const set = (field: keyof DraftRule) => (value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const save = () => {
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const clean: DraftRule = {
      context_cue: draft.context_cue.trim(),
      behavior_command: draft.behavior_command.trim(),
      why_true: draft.why_true.trim(),
      arguing_pair_clash: draft.arguing_pair_clash.trim(),
    };
    onSaveRule(clean);
    setSavedRules((r) => [...r, clean]);
    setDraft(EMPTY_DRAFT);
  };

  const field = (
    label: string,
    icon: React.ReactNode,
    key: keyof DraftRule,
    placeholder: string,
    multiline: boolean,
    maxLength?: number
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-400">
        {icon} {label}
        {maxLength && (
          <span className="ml-auto font-mono normal-case text-neutral-600">
            {draft[key].length}/{maxLength}
          </span>
        )}
      </span>
      {multiline ? (
        <textarea
          value={draft[key]}
          onChange={(e) => set(key)(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`resize-y rounded-lg border bg-surface p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent ${
            errors[key] ? "border-red-700" : "border-neutral-800"
          }`}
        />
      ) : (
        <input
          value={draft[key]}
          onChange={(e) => set(key)(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength ? maxLength + 20 : undefined}
          className={`rounded-lg border bg-surface p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent ${
            errors[key] ? "border-red-700" : "border-neutral-800"
          }`}
        />
      )}
      {errors[key] && <span className="text-xs text-red-400">{errors[key]}</span>}
    </label>
  );

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-2">
      {/* -------------------------------------------- Raw dump for mining */}
      <section className="rounded-2xl border border-neutral-800 bg-surface-raised p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <ListChecks size={15} className="text-accent-soft" />
          Your raw recall (read-only)
        </h3>
        <pre className="max-h-[520px] overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-neutral-400">
          {brainDumpMarkdown || "— empty dump —"}
        </pre>
      </section>

      {/* -------------------------------------------- Forge */}
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-surface-raised p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles size={15} className="text-accent-soft" />
          Forge a doctrine rule
        </h3>

        {field(
          "If — Context Cue",
          <Zap size={12} className="text-amber-400" />,
          "context_cue",
          "Morning Coffee / Before opening email / When challenged in a meeting",
          false,
          CUE_MAX
        )}
        {field(
          "Then — Behavior Command",
          <ArrowRight size={12} className="text-emerald-400" />,
          "behavior_command",
          "Write the day's single most important task on paper.",
          false,
          COMMAND_MAX
        )}
        {field(
          "Why is this true?",
          <CheckCircle2 size={12} className="text-sky-400" />,
          "why_true",
          "The causal mechanism, in your own words. What makes this rule work?",
          true
        )}
        {field(
          "Arguing Pair Clash",
          <MessageSquareWarning size={12} className="text-orange-400" />,
          "arguing_pair_clash",
          "Steelman the best objection — then explain why the rule survives it.",
          true
        )}

        <button
          onClick={save}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-soft"
        >
          <Plus size={15} />
          Save to Living Doctrine (starts 1-day review clock)
        </button>

        <AnimatePresence>
          {savedRules.map((rule, i) => (
            <motion.p
              key={`${rule.context_cue}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-emerald-200"
            >
              <span className="text-neutral-400">If </span>
              {rule.context_cue}
              <span className="text-neutral-400"> → then </span>
              {rule.behavior_command}
            </motion.p>
          ))}
        </AnimatePresence>
      </section>
    </div>
  );
}
