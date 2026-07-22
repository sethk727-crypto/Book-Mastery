"use client";

// ============================================================================
// /library — every uploaded book, lifetime reading stats, reopen or delete.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  BookUp2,
  Clock,
  Gauge,
  Library,
  Loader2,
  LogIn,
  Trash2,
  Type,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { Book } from "@/lib/types";

type PageState = "loading" | "unconfigured" | "signedOut" | "ready";

interface ReadingStats {
  totalWords: number;
  totalMinutes: number;
  sessionCount: number;
  avgWPM: number;
}

const EMPTY_STATS: ReadingStats = {
  totalWords: 0,
  totalMinutes: 0,
  sessionCount: 0,
  avgWPM: 0,
};

export default function LibraryPage() {
  const [state, setState] = useState<PageState>("loading");
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<ReadingStats>(EMPTY_STATS);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setState("signedOut");
        return;
      }

      const [booksRes, sessionsRes] = await Promise.all([
        supabase.from("books").select("*").order("created_at", { ascending: false }),
        supabase.from("rsvp_sessions").select("words_consumed, active_ms"),
      ]);

      setBooks((booksRes.data as Book[] | null) ?? []);

      const sessions = sessionsRes.data ?? [];
      const totalWords = sessions.reduce((sum, s) => sum + (s.words_consumed ?? 0), 0);
      const totalMs = sessions.reduce((sum, s) => sum + (s.active_ms ?? 0), 0);
      setStats({
        totalWords,
        totalMinutes: Math.round(totalMs / 60_000),
        sessionCount: sessions.length,
        avgWPM: totalMs > 0 ? Math.round((totalWords / totalMs) * 60_000) : 0,
      });
      setState("ready");
    } catch {
      setState("unconfigured");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteBook = useCallback(
    async (book: Book) => {
      if (
        !window.confirm(
          `Delete "${book.title}"? This removes the PDF and its extracted text permanently.`
        )
      ) {
        return;
      }
      setDeletingId(book.id);
      setError(null);
      try {
        const supabase = getSupabase();
        if (book.storage_path) {
          await supabase.storage.from("books").remove([book.storage_path]);
        }
        const { error: dbError } = await supabase.from("books").delete().eq("id", book.id);
        if (dbError) throw new Error(dbError.message);
        setBooks((prev) => prev.filter((b) => b.id !== book.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Library size={22} className="text-accent-soft" />
        <div>
          <h1 className="text-xl font-bold text-white">Library</h1>
          <p className="text-sm text-neutral-400">
            Every book you&apos;ve uploaded, and your lifetime reading tally.
          </p>
        </div>
      </header>

      {state === "loading" && (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 size={15} className="animate-spin" /> Loading your library…
        </p>
      )}

      {state === "unconfigured" && (
        <p className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-6 text-center text-sm text-amber-200">
          The database isn&apos;t connected yet, so there&apos;s no library to
          show. Follow the Supabase setup in the README, then reload.
        </p>
      )}

      {state === "signedOut" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-surface-raised p-10 text-center">
          <p className="text-sm text-neutral-300">
            Sign in to see your uploaded books and reading stats.
          </p>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-soft"
          >
            <LogIn size={15} /> Sign in with email
          </Link>
        </div>
      )}

      {state === "ready" && (
        <>
          {/* -------------------------------------------- Lifetime stats */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Type, label: "Words read", value: stats.totalWords.toLocaleString() },
              { icon: Clock, label: "Minutes reading", value: stats.totalMinutes.toLocaleString() },
              { icon: BookOpen, label: "Sprints", value: String(stats.sessionCount) },
              { icon: Gauge, label: "Lifetime avg WPM", value: stats.avgWPM ? String(stats.avgWPM) : "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-neutral-800 bg-surface-raised p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500">
                  <Icon size={12} /> {label}
                </div>
                <p className="mt-1 font-mono text-xl text-white">{value}</p>
              </div>
            ))}
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {/* -------------------------------------------- Book list */}
          {books.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-surface-raised p-10 text-center">
              <p className="text-sm text-neutral-400">
                No books yet — upload your first PDF to start.
              </p>
              <Link
                href="/absorb"
                className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-soft"
              >
                <BookUp2 size={15} /> Upload a book
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-surface-raised p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{book.title}</p>
                    <p className="text-xs text-neutral-500">
                      {book.word_count > 0
                        ? `${book.word_count.toLocaleString()} words`
                        : "no text extracted"}
                      {" · "}
                      added {new Date(book.created_at).toLocaleDateString()}
                      {" · "}
                      <span
                        className={
                          book.status === "ready" ? "text-emerald-400" : "text-amber-400"
                        }
                      >
                        {book.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {book.status === "ready" && (
                      <Link
                        href={`/absorb?book=${book.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-soft"
                      >
                        <BookOpen size={14} /> Read
                      </Link>
                    )}
                    <button
                      onClick={() => void deleteBook(book)}
                      disabled={deletingId === book.id}
                      aria-label={`Delete ${book.title}`}
                      className="rounded-lg p-2 text-neutral-500 transition hover:bg-red-950/40 hover:text-red-400 disabled:opacity-40"
                    >
                      {deletingId === book.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
