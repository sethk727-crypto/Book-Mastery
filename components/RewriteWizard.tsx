"use client";

// ============================================================================
// RewriteWizard — create a real schema rewrite (Ecker Steps A → B → C).
// Step C auto-prefills from evidence saved in the book's search panel
// ("Save as disconfirming evidence"), closing the loop between your PDF
// and the Juxtaposition Studio.
// ============================================================================

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BookOpen, Brain, ChevronRight, Sparkles, X } from "lucide-react";
import { PENDING_EVIDENCE_KEY, type PendingEvidence } from "@/components/BookNavigator";

export interface RewriteDraft {
  friction_description: string;
  old_schema: string;
  old_schema_emotional_charge: number;
  disconfirming_evidence: string;
  evidence_source_locator: string;
  book_id: string | null;
}

export interface RewriteWizardProps {
  onSave: (draft: RewriteDraft) => void;
  onClose: () => void;
}

export default function RewriteWizard({ onSave, onClose }: RewriteWizardProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [friction, setFriction] = useState("");
  const [oldSchema, setOldSchema] = useState("");
  const [charge, setCharge] = useState(5);
  const [evidence, setEvidence] = useState("");
  const [locator, setLocator] = useState("");
  const [bookId, setBookId] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Pull evidence saved from the book search panel, if any.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_EVIDENCE_KEY);
      if (!raw) return;
      const pending = JSON.parse(raw) as PendingEvidence;
      setEvidence(pending.text);
      setLocator(pending.locator);
      setBookId(pending.bookId);
      setPrefilled(true);
    } catch {
      // no pending evidence
    }
  }, []);

  const steps = [
    {
      icon: AlertTriangle,
      title: "Step A — Friction",
      prompt: "What unwanted reaction, block, or behavior keeps showing up?",
      valid: friction.trim().length >= 10,
    },
    {
      icon: Brain,
      title: "Step B — Target Schema",
      prompt:
        "Finish the sentence the behavior is obeying: “If I don't do this, then…”. Write the old implicit belief in its own voice.",
      valid: oldSchema.trim().length >= 10,
    },
    {
      icon: BookOpen,
      title: "Step C — Disconfirming Evidence",
      prompt:
        "The fact or passage that the old belief cannot survive contact with. Pull it from your book via Search → “Save as disconfirming evidence”.",
      valid: evidence.trim().length >= 10,
    },
  ] as const;

  const save = () => {
    onSave({
      friction_description: friction.trim(),
      old_schema: oldSchema.trim(),
      old_schema_emotional_charge: charge,
      disconfirming_evidence: evidence.trim(),
      evidence_source_locator: locator.trim(),
      book_id: bookId,
    });
    try {
      localStorage.removeItem(PENDING_EVIDENCE_KEY);
    } catch {
      // ignore
    }
  };

  const StepIcon = steps[step].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-xl rounded-2xl bg-surface-raised p-6"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-500 hover:bg-surface-overlay hover:text-white"
          aria-label="Close wizard"
        >
          <X size={18} />
        </button>

        {/* Step rail */}
        <div className="mb-5 flex items-center gap-2 text-xs">
          {steps.map((s, i) => (
            <span key={s.title} className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 ${
                  i === step
                    ? "bg-accent text-white"
                    : i < step
                      ? "bg-emerald-950/60 text-emerald-300"
                      : "bg-surface text-neutral-500"
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {i < steps.length - 1 && <ChevronRight size={12} className="text-neutral-600" />}
            </span>
          ))}
        </div>

        <h3 className="mb-1 flex items-center gap-2 font-semibold text-white">
          <StepIcon size={17} className="text-accent-soft" />
          {steps[step].title}
        </h3>
        <p className="mb-4 text-sm text-neutral-400">{steps[step].prompt}</p>

        {step === 0 && (
          <textarea
            value={friction}
            onChange={(e) => setFriction(e.target.value)}
            rows={4}
            placeholder="e.g. I compulsively check email every few minutes while trying to do deep work."
            className="w-full resize-y rounded-lg border border-neutral-800 bg-surface p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
            autoFocus
          />
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <textarea
              value={oldSchema}
              onChange={(e) => setOldSchema(e.target.value)}
              rows={4}
              placeholder="e.g. If I don't respond instantly, people will think I'm unreliable and I'll fall behind."
              className="w-full resize-y rounded-lg border border-neutral-800 bg-surface p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
              autoFocus
            />
            <label className="flex flex-col gap-1.5 text-xs text-neutral-400">
              How emotionally charged does saying that belief out loud feel? ({charge}/10)
              <input
                type="range"
                min={1}
                max={10}
                value={charge}
                onChange={(e) => setCharge(Number(e.target.value))}
                className="accent-indigo-500"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            {prefilled && (
              <p className="flex items-center gap-1.5 rounded-lg border border-emerald-800 bg-emerald-950/20 p-2.5 text-xs text-emerald-300">
                <Sparkles size={12} className="shrink-0" />
                Prefilled from the passage you saved in your book&apos;s search panel.
              </p>
            )}
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={5}
              placeholder="The contradictory fact or passage, in full."
              className="w-full resize-y rounded-lg border border-neutral-800 bg-surface p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
            />
            <input
              value={locator}
              onChange={(e) => setLocator(e.target.value)}
              placeholder="Source (book, chapter, page) — optional"
              className="rounded-lg border border-neutral-800 bg-surface p-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
            />
          </div>
        )}

        <div className="mt-5 flex justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1) as 0 | 1 | 2)}
            disabled={step === 0}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white disabled:opacity-30"
          >
            Back
          </button>
          {step < 2 ? (
            <button
              onClick={() => setStep((s) => Math.min(2, s + 1) as 0 | 1 | 2)}
              disabled={!steps[step].valid}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={save}
              disabled={!steps[2].valid}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-40"
            >
              Save — ready for juxtaposition
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
