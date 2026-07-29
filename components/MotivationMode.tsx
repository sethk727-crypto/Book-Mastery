"use client";

// ============================================================================
// MotivationMode — the vision-board RSVP. Your own images (supercars, the
// house, the goals) rotate as the backdrop while an NLP-paced monologue
// speaks to you by name, word by word, with your journal's affirmations
// rotating alongside. Images upload straight into Supabase Storage from
// this screen.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flame,
  ImagePlus,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  Quote,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRSVPReader } from "@/hooks/useRSVPReader";
import { buildMotivationScript, MOTIVATION_QUOTES } from "@/lib/motivation";
import { getSupabase } from "@/lib/supabase";

const WPM_STEP = 20;
const IMAGE_ROTATE_MS = 8000;
const QUOTE_ROTATE_MS = 10_000;

// Default vision images (shipped with the app) — used until the user
// uploads their own set, which then replaces these entirely.
const DEFAULT_IMAGES = Array.from(
  { length: 12 },
  (_, i) =>
    `/motivation-defaults/vision-${String(i + 1).padStart(2, "0")}.${
      ["webp", "jpg", "jpg", "jpg", "webp", "jpg", "jpg", "jpg", "jpg", "jpg", "webp", "avif"][i]
    }`
);

interface VisionImage {
  path: string;
  url: string;
}

export default function MotivationMode() {
  // ---- Personalization -----------------------------------------------------
  const [name, setName] = useState("Seth");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("motivation:name");
      if (saved) setName(saved);
    } catch {
      // default stands
    }
  }, []);
  const changeName = (value: string) => {
    setName(value);
    try {
      localStorage.setItem("motivation:name", value);
    } catch {
      // ignore
    }
  };

  const script = useMemo(() => buildMotivationScript(name), [name]);

  // ---- RSVP engine (slower, phrase-chunked, hypnotic) ----------------------
  const reader = useRSVPReader(script, { initialWPM: 220, chunkSize: 2 });
  const { token, isPlaying, isComplete, wpm, toggle, restart, setWPM } = reader;

  // ---- Vision images -------------------------------------------------------
  const [images, setImages] = useState<VisionImage[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  }, []);

  const loadImages = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    try {
      const res = await fetch("/api/vision", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json()) as { images?: VisionImage[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not load images");
      setImages(payload.images ?? []);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not load images");
    }
  }, [getToken]);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  const uploadImages = useCallback(
    async (fileList: FileList) => {
      setUploading(true);
      setUploadError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Sign in first to save your vision images.");

        const files = Array.from(fileList).slice(0, 20);
        const oversized = files.find((f) => f.size > 10 * 1024 * 1024);
        if (oversized) {
          throw new Error(`"${oversized.name}" is over 10 MB — resize it and retry.`);
        }

        // 1. Ask the server for one-time signed upload slots.
        const res = await fetch("/api/vision", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            files: files.map((f) => ({ name: f.name, type: f.type })),
          }),
        });
        const payload = (await res.json()) as {
          uploads?: Array<{ path: string; token: string }>;
          error?: string;
        };
        if (!res.ok || !payload.uploads) {
          throw new Error(payload.error ?? "Upload failed");
        }

        // 2. Send the bytes straight from the browser to storage.
        const storage = getSupabase().storage.from("motivation");
        for (let i = 0; i < payload.uploads.length; i++) {
          const { path, token: uploadToken } = payload.uploads[i];
          const { error } = await storage.uploadToSignedUrl(path, uploadToken, files[i], {
            contentType: files[i].type || "image/jpeg",
          });
          if (error) throw new Error(`${files[i].name}: ${error.message}`);
        }

        await loadImages();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [getToken, loadImages]
  );

  const deleteImage = useCallback(
    async (path: string) => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/vision", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path }),
        });
        const payload = (await res.json()) as { images?: VisionImage[] };
        if (res.ok) setImages(payload.images ?? []);
      } catch {
        // ignore
      }
    },
    [getToken]
  );

  // ---- Backdrop + quote rotation ------------------------------------------
  const backdrops: VisionImage[] =
    images.length > 0
      ? images
      : DEFAULT_IMAGES.map((url) => ({ path: url, url }));
  const [bgIndex, setBgIndex] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const backdropCount = backdrops.length;

  // Start on a random image each session.
  useEffect(() => {
    if (backdropCount > 1) {
      setBgIndex(Math.floor(Math.random() * backdropCount));
    }
  }, [backdropCount]);

  useEffect(() => {
    if (!isPlaying) return;
    const imageTimer = setInterval(() => {
      // Randomized rotation — always a different image than the current one.
      setBgIndex((current) => {
        if (backdropCount <= 1) return current;
        let next = Math.floor(Math.random() * backdropCount);
        if (next === current) next = (next + 1) % backdropCount;
        return next;
      });
    }, IMAGE_ROTATE_MS);
    const quoteTimer = setInterval(
      () => setQuoteIndex((i) => (i + 1) % MOTIVATION_QUOTES.length),
      QUOTE_ROTATE_MS
    );
    return () => {
      clearInterval(imageTimer);
      clearInterval(quoteTimer);
    };
  }, [isPlaying, backdropCount]);

  // ---- Fullscreen: native API first (element stays in place — no remount),
  // CSS overlay fallback where native is blocked (iPhone Safari). ----------
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fsMode, setFsMode] = useState<"off" | "native" | "overlay">("off");
  const isFullscreen = fsMode !== "off";

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setFsMode((m) => (m === "native" ? "off" : m));
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    void (async () => {
      if (fsMode === "overlay") {
        setFsMode("off");
        return;
      }
      if (fsMode === "native") {
        try {
          await document.exitFullscreen();
        } catch {
          // listener syncs; force below
        }
        setFsMode("off");
        return;
      }
      const el = canvasRef.current as
        | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> })
        | null;
      try {
        if (el?.requestFullscreen) {
          await el.requestFullscreen();
          setFsMode("native");
          return;
        }
        if (el?.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
          setFsMode("native");
          return;
        }
      } catch {
        // fall through to overlay
      }
      setFsMode("overlay");
    })();
  }, [fsMode]);

  // Overlay mode: lock scroll behind it and exit on Escape.
  useEffect(() => {
    if (fsMode !== "overlay") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFsMode("off");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fsMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentImage = backdrops[bgIndex % backdrops.length];

  // ---- The canvas ----------------------------------------------------------
  const canvas = (
    <div
      ref={canvasRef}
      className={`relative cursor-pointer overflow-hidden bg-atmos-midnight ${
        fsMode === "native"
          ? "h-full w-full"
          : fsMode === "overlay"
            ? "fixed inset-0 z-[9999] h-[100dvh] w-screen"
            : "h-[70vh] min-h-[420px] rounded-2xl border border-neutral-800"
      }`}
      onClick={toggle}
    >
      {/* Backdrop — user image or brand gradient, slow Ken Burns drift */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentImage.path}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: 1.08 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.6 }, scale: { duration: IMAGE_ROTATE_MS / 1000 + 2, ease: "linear" } }}
          style={{
            backgroundImage: `url(${currentImage.url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </AnimatePresence>

      {/* Readability veil */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75" />

      {/* The words */}
      <div className="absolute inset-0 flex items-center justify-center px-[8vw]">
        <AnimatePresence mode="popLayout">
          {token && (
            <motion.p
              key={`${token.startWordIndex}-${token.text}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="text-center font-sans text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl"
              style={{
                textShadow:
                  "0 0 18px rgba(255,200,87,0.55), 0 0 60px rgba(255,138,101,0.35), 0 2px 24px rgba(0,0,0,0.8)",
              }}
            >
              {token.text}
            </motion.p>
          )}
        </AnimatePresence>
        {!isPlaying && !token && (
          <p className="text-center text-sm text-neutral-400">Press play to begin.</p>
        )}
      </div>

      {/* Rotating quote — bottom left */}
      <div className="absolute bottom-5 left-5 right-24 select-none">
        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6 }}
            className="flex max-w-xl items-start gap-2 text-xs italic leading-relaxed text-atmos-dawnGold/80 sm:text-sm"
          >
            <Quote size={13} className="mt-0.5 shrink-0 opacity-60" />
            {MOTIVATION_QUOTES[quoteIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Controls — top right */}
      <div
        className="absolute right-3 top-3 flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={toggle}
          className="rounded-lg bg-black/50 p-2.5 text-neutral-300 backdrop-blur transition hover:text-white"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={restart}
          className="rounded-lg bg-black/50 p-2.5 text-neutral-300 backdrop-blur transition hover:text-white"
          aria-label="Restart"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={() => setWPM(wpm - WPM_STEP)}
          className="rounded-lg bg-black/50 p-2.5 text-neutral-300 backdrop-blur transition hover:text-white"
          aria-label="Slower"
        >
          <Minus size={16} />
        </button>
        <span className="select-none font-mono text-xs text-neutral-400">{wpm}</span>
        <button
          onClick={() => setWPM(wpm + WPM_STEP)}
          className="rounded-lg bg-black/50 p-2.5 text-neutral-300 backdrop-blur transition hover:text-white"
          aria-label="Faster"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={toggleFullscreen}
          className="rounded-lg bg-black/50 p-2.5 text-neutral-300 backdrop-blur transition hover:text-white"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {isComplete && (
        <div
          className="absolute inset-x-0 bottom-16 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={restart}
            className="rounded-xl bg-atmos-dawnGold px-6 py-3 text-sm font-bold text-atmos-midnight transition hover:brightness-110"
          >
            Run it again — then go execute.
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {canvas}

      {/* ---- Setup row: name + image management (hidden in fullscreen) ---- */}
      {!isFullscreen && (
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-surface-raised p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Flame size={16} className="text-atmos-coral" />
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              It speaks to
              <input
                value={name}
                onChange={(e) => changeName(e.target.value)}
                maxLength={20}
                className="w-28 rounded-md border border-neutral-800 bg-surface px-2 py-1 text-center text-sm font-medium text-white outline-none focus:border-accent"
              />
            </label>
            <span className="text-xs text-neutral-600">
              2-word flow · punctuation drives the pauses · slower is deeper
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !signedIn}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImagePlus size={14} />
              )}
              Add vision images
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadImages(e.target.files);
                e.target.value = "";
              }}
            />
            {!signedIn && (
              <span className="text-xs text-amber-400">
                Sign in to upload your own — the starter set plays meanwhile.
              </span>
            )}
            {signedIn && images.length === 0 && !uploading && (
              <span className="text-xs text-neutral-500">
                No uploads yet — showing the starter set.
              </span>
            )}
            {uploadError && <span className="text-xs text-red-400">{uploadError}</span>}
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <div key={img.path} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt="Vision board"
                    className="h-16 w-24 rounded-lg border border-neutral-800 object-cover"
                  />
                  <button
                    onClick={() => void deleteImage(img.path)}
                    className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-600 p-1 text-white group-hover:block"
                    aria-label="Remove image"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-neutral-600">
            Your starter vision set (the cars, the penthouses, the life) rotates
            behind the words. Upload your own images and they take over the
            rotation — stored privately in your account folder. High-definition,
            landscape shots look best.
          </p>
        </div>
      )}
    </div>
  );
}
