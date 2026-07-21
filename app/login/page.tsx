"use client";

// ============================================================================
// /login — email magic-link sign-in via Supabase Auth. No passwords: enter
// an email, click the link that arrives, and you're signed in.
// ============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookUp2, LogIn, LogOut, MailCheck } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type AuthState = "loading" | "unconfigured" | "signedOut" | "sent" | "signedIn";

export default function LoginPage() {
  const [state, setState] = useState<AuthState>("loading");
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const supabase = getSupabase();
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setUserEmail(session.user.email ?? null);
          setState("signedIn");
        } else {
          setState((s) => (s === "loading" ? "signedOut" : s));
        }
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setUserEmail(session.user.email ?? null);
          setState("signedIn");
        }
      });
      return () => sub.subscription.unsubscribe();
    } catch {
      setState("unconfigured");
    }
  }, []);

  const sendLink = async () => {
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const { error: otpError } = await getSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (otpError) throw otpError;
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    setUserEmail(null);
    setState("signedOut");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-neutral-800 bg-surface-raised p-8">
        <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-white">
          <LogIn size={20} className="text-accent-soft" />
          Sign in
        </h1>
        <p className="mb-6 text-sm text-neutral-400">
          Your books, rules, and progress are saved to your account.
        </p>

        {state === "loading" && (
          <p className="text-sm text-neutral-500">Checking session…</p>
        )}

        {state === "unconfigured" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              The database isn&apos;t connected yet. Set{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              (see the README), then reload this page.
            </span>
          </div>
        )}

        {state === "signedOut" && (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && void sendLink()}
              placeholder="you@example.com"
              className="rounded-lg border border-neutral-800 bg-surface p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
            />
            <button
              onClick={() => void sendLink()}
              disabled={busy}
              className="rounded-lg bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <p className="text-xs text-neutral-500">
              No password needed — we email you a one-click link.
            </p>
          </div>
        )}

        {state === "sent" && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/20 p-4 text-sm text-emerald-300">
            <MailCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              Link sent to <span className="font-medium">{email}</span>. Open
              the email on this device and click it — you&apos;ll land back here
              signed in.
            </span>
          </div>
        )}

        {state === "signedIn" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-300">
              Signed in as{" "}
              <span className="font-medium text-white">{userEmail}</span>.
            </p>
            <Link
              href="/absorb"
              className="flex items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-soft"
            >
              <BookUp2 size={15} />
              Upload a book
            </Link>
            <button
              onClick={() => void signOut()}
              className="flex items-center justify-center gap-2 rounded-lg bg-surface-overlay py-2.5 text-sm text-neutral-400 transition hover:text-white"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-neutral-600">
        <Link href="/" className="underline hover:text-neutral-400">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
