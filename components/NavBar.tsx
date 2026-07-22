"use client";

// ============================================================================
// NavBar — persistent top navigation on every page.
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookUp2, Brain, Library, LogIn, LogOut } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "Dashboard", icon: Brain },
  { href: "/absorb", label: "Read a Book", icon: BookUp2 },
  { href: "/library", label: "Library", icon: Library },
] as const;

export default function NavBar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    try {
      const supabase = getSupabase();
      void supabase.auth
        .getSession()
        .then(({ data: { session } }) => setEmail(session?.user.email ?? null));
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
        setEmail(session?.user.email ?? null)
      );
      return () => sub.subscription.unsubscribe();
    } catch {
      setConfigured(false);
    }
  }, []);

  const signOut = async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      // unconfigured — nothing to sign out of
    }
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-neutral-800 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-accent text-white"
                    : "text-neutral-400 hover:bg-surface-overlay hover:text-white"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-sm">
          {!configured ? (
            <span className="text-xs text-neutral-600">demo mode</span>
          ) : email ? (
            <>
              <span className="hidden max-w-[160px] truncate text-xs text-neutral-500 md:inline">
                {email}
              </span>
              <button
                onClick={() => void signOut()}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-neutral-400 transition hover:bg-surface-overlay hover:text-white"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-lg bg-surface-overlay px-3 py-2 text-neutral-200 transition hover:bg-accent hover:text-white"
            >
              <LogIn size={14} />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
