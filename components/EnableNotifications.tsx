"use client";

// ============================================================================
// EnableNotifications — one-tap opt-in for the daily reminder push digest.
// ============================================================================

import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { enablePushReminders } from "@/lib/push";

type State = "idle" | "working" | "enabled" | "failed";

export default function EnableNotifications() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const enable = async () => {
    setState("working");
    const result = await enablePushReminders();
    if (result.ok) {
      setState("enabled");
      setMessage(null);
    } else {
      setState("failed");
      setMessage(result.message);
    }
  };

  if (state === "enabled") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <BellRing size={13} /> Daily reminders on — you&apos;ll get a push when
        reviews or habits are waiting.
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={() => void enable()}
        disabled={state === "working"}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-accent hover:text-white disabled:opacity-50"
      >
        {state === "working" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Bell size={13} />
        )}
        Enable daily reminders
      </button>
      {message && <span className="text-xs text-amber-400">{message}</span>}
    </div>
  );
}
